import type { Prisma } from '@prisma/client';

import { acquireListingBookingLock } from '../../lib/advisoryLock.js';
import { asObject } from '../../lib/json.js';
import { toPrismaJson } from '../../lib/prisma.js';

/**
 * Règles d'anonymisation partagées par la suppression de compte (`privacy.service.ts`) et la purge
 * automatique (`jobs/retention.ts`). Les lignes ne sont jamais supprimées : les montants et les
 * identifiants Stripe restent (pièces comptables 10 ans), seules les données personnelles partent.
 */

export const DELETED_MESSAGE_BODY = '[message supprimé]';
export const ANONYMIZED_GUEST_NAME = 'Voyageur';

type DbClient = Prisma.TransactionClient;

function nowIso(): string {
  return new Date().toISOString();
}

/** Ne garde que les compteurs (adultes, enfants…) : un besoin d'accessibilité est une donnée de santé. */
export function anonymizeGuestCounts(guests: unknown): Record<string, number> {
  const source = asObject(guests);
  const counts: Record<string, number> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'number' && Number.isFinite(value)) counts[key] = value;
  }
  return counts;
}

/**
 * Champs d'une réservation (ligne `Reservation` et sa copie dans `Listing.bookings.reservations`)
 * une fois le voyageur anonymisé. `contact.anonymizedAt` sert de marqueur d'idempotence.
 */
export function buildAnonymizedReservationFields(anonymizedAtISO = nowIso()) {
  return {
    guestName: ANONYMIZED_GUEST_NAME,
    guestAvatar: null,
    message: null,
    internalNote: null,
    contact: { anonymizedAt: anonymizedAtISO },
    messaging: {},
  };
}

/** Copie d'une réservation dans le JSON de l'annonce, anonymisée (même règle que la ligne). */
export function anonymizeReservationRecord(record: Record<string, unknown>, anonymizedAtISO = nowIso()): Record<string, unknown> {
  const fields = buildAnonymizedReservationFields(anonymizedAtISO);
  const {
    confirmation: _confirmation,
    guestAvatar: _guestAvatar,
    message: _message,
    internalNote: _internalNote,
    ...rest
  } = record;
  return {
    ...rest,
    guestName: fields.guestName,
    guests: anonymizeGuestCounts(record.guests),
    contact: fields.contact,
    messaging: fields.messaging,
  };
}

/** Copie d'une réservation dans le JSON de l'annonce sans le fil de messages (purge à 1 an). */
export function stripReservationRecordMessages(record: Record<string, unknown>): Record<string, unknown> {
  const messaging = asObject(record.messaging);
  const { messages: _messages, ...restMessaging } = messaging;
  return { ...record, messaging: restMessaging };
}

function readReservationRecordId(record: Record<string, unknown>): string | null {
  const value = record.id ?? record.reservationId;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Réécrit les copies de réservations du JSON d'une annonce, sous le verrou consultatif de l'annonce
 * (même verrou que la création de réservation) pour ne jamais écraser une écriture concurrente.
 */
export async function rewriteListingReservationCopies(
  tx: DbClient,
  listingId: string,
  reservationIds: ReadonlySet<string>,
  rewrite: (record: Record<string, unknown>) => Record<string, unknown>,
): Promise<number> {
  if (!reservationIds.size) return 0;

  await acquireListingBookingLock(tx, listingId);

  const listing = await tx.listing.findUnique({
    where: { id: listingId },
    select: { bookings: true },
  });
  if (!listing) return 0;

  const bookings = asObject(listing.bookings);
  if (!Array.isArray(bookings.reservations)) return 0;

  let rewritten = 0;
  const reservations = bookings.reservations.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    const record = item as Record<string, unknown>;
    const id = readReservationRecordId(record);
    if (!id || !reservationIds.has(id)) return item;
    rewritten += 1;
    return rewrite(record);
  });

  if (!rewritten) return 0;

  await tx.listing.update({
    where: { id: listingId },
    data: { bookings: toPrismaJson({ ...bookings, reservations }) },
  });

  return rewritten;
}

/**
 * Anonymise des réservations (lignes + copies JSON + sujet de conversation, qui contenait nom et
 * téléphone du voyageur). Les réservations sont regroupées par annonce pour prendre un seul verrou.
 */
export async function anonymizeReservations(
  tx: DbClient,
  reservations: ReadonlyArray<{ id: string; listingId: string }>,
  anonymizedAtISO = nowIso(),
): Promise<number> {
  if (!reservations.length) return 0;

  const ids = reservations.map((reservation) => reservation.id);
  const byListing = new Map<string, Set<string>>();
  for (const reservation of reservations) {
    const set = byListing.get(reservation.listingId) ?? new Set<string>();
    set.add(reservation.id);
    byListing.set(reservation.listingId, set);
  }

  const rows = await tx.reservation.findMany({
    where: { id: { in: ids } },
    select: { id: true, guests: true },
  });

  const fields = buildAnonymizedReservationFields(anonymizedAtISO);
  for (const row of rows) {
    await tx.reservation.update({
      where: { id: row.id },
      data: {
        guestName: fields.guestName,
        guestAvatar: fields.guestAvatar,
        message: fields.message,
        internalNote: fields.internalNote,
        guests: toPrismaJson(anonymizeGuestCounts(row.guests)),
        contact: toPrismaJson(fields.contact),
        messaging: toPrismaJson(fields.messaging),
      },
    });
  }

  await tx.conversation.updateMany({
    where: { reservationId: { in: ids } },
    data: { subject: null },
  });

  for (const [listingId, set] of byListing) {
    await rewriteListingReservationCopies(tx, listingId, set, (record) => anonymizeReservationRecord(record, anonymizedAtISO));
  }

  return rows.length;
}

/** Statut « annulée » d'une réservation, lu dans son JSON `payment` (même règle que bookings). */
export function isReservationCanceled(payment: unknown): boolean {
  const cancellation = asObject(asObject(payment).cancellation);
  return cancellation.status === 'canceled';
}

/**
 * Champs d'une annonce dont le propriétaire a fermé son compte : l'annonce devient `deleted`, les
 * données de l'hôte (profil, guide d'arrivée, adresse précise, avis, médias, domaines) partent, les
 * réservations restent (5 ans, purgées ensuite par le job de rétention).
 */
export function buildAnonymizedListingData(core: unknown): Prisma.ListingUncheckedUpdateInput {
  const sourceCore = asObject(core);
  const {
    precise_address: _preciseAddress,
    preciseAddress: _preciseAddressCamel,
    ...restCore
  } = sourceCore;

  return {
    status: 'deleted',
    hasPendingChanges: false,
    subdomainSlug: null,
    customDomain: null,
    customDomainVerifiedAt: null,
    customDomainVerificationToken: null,
    core: toPrismaJson({ ...restCore, status: 'deleted' }),
    medias: toPrismaJson({ images: [], videos: [] }),
    arrival: toPrismaJson({}),
    notes: toPrismaJson({}),
    comments: toPrismaJson({}),
    host: toPrismaJson(null),
  };
}

/** Profil Stripe réduit aux identifiants et au statut : rien de nominatif, mais la facturation reste traçable. */
export function buildAnonymizedStripeProfile(profile: unknown): Record<string, unknown> {
  const source = asObject(profile);
  const billing = asObject(source.billing);
  const keep = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null);

  return {
    anonymizedAt: nowIso(),
    accountId: keep(source.accountId),
    billing: {
      customerId: keep(billing.customerId),
      subscriptionId: keep(billing.subscriptionId),
      planCode: keep(billing.planCode),
      status: keep(billing.status),
      currentPeriodEndISO: keep(billing.currentPeriodEndISO),
    },
  };
}
