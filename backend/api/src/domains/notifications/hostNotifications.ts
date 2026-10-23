// E-mails automatiques aux hôtes. Les fonctions d'événement (réservation, annulation, message…) sont
// appelées en « fire-and-forget » par les domaines concernés : elles attrapent tout et ne lèvent
// jamais. Les rappels planifiés passent par `jobs/hostReminders.ts`, avec le même `deliverHostEmail`.
//
// Chaque envoi pose d'abord une ligne `HostNotification` (clé unique) : un même événement ne part
// qu'une fois, même si deux traitements se chevauchent. La ligne est retirée si l'envoi échoue, pour
// qu'un rappel planifié soit retenté au passage suivant.

import { createHmac, timingSafeEqual } from 'node:crypto';

import { Prisma, type PrismaClient, type User } from '@prisma/client';

import { env } from '../../config/env.js';
import { asObject } from '../../lib/json.js';
import { isMailerConfigured, resolvePublicBaseUrl, sendMail } from '../../lib/mailer.js';
import type { RenderedEmail } from './bookingConfirmation.js';
import {
  buildHostListingLimitReachedEmail,
  buildHostListingPublishedEmail,
  describeListingAllowance,
} from './hostAccountEmails.js';
import {
  buildHostBookingCanceledEmail,
  buildHostBookingReceivedEmail,
  buildHostDisputeEmail,
  buildHostGuestMessageEmail,
  buildHostRefundFailedEmail,
  buildHostReviewReceivedEmail,
  type GuestContact,
} from './hostBookingEmails.js';
import { SUPPORT_EMAIL, parseIsoDate, readGuestsBreakdown } from './mailLayout.js';
import { readBookingAmounts, type BookingNotificationContext } from './notifications.service.js';

export type HostEmailKind =
  | 'booking_received'
  | 'booking_canceled'
  | 'arrival_tomorrow'
  | 'guest_message'
  | 'review_received'
  | 'dispute_opened'
  | 'refund_failed'
  | 'listing_published'
  | 'listing_limit_reached'
  | 'welcome'
  | 'draft_reminder'
  | 'connect_incomplete'
  | 'plan_ending'
  | 'calendar_sync_error';

/** Rappels que l'hôte peut refuser (lien en pied de page) ; les autres accompagnent une réservation ou un paiement. */
const REMINDER_KINDS = new Set<HostEmailKind>(['draft_reminder', 'connect_incomplete', 'listing_limit_reached']);

/** Un e-mail par conversation au plus toutes les 30 minutes, quel que soit le nombre de messages. */
const GUEST_MESSAGE_THROTTLE_MS = 30 * 60 * 1000;
const GUEST_MESSAGE_EXCERPT_MAX = 600;

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

// --- Liens -----------------------------------------------------------------------------------

export function buildHostLinks(baseUrl = resolvePublicBaseUrl()) {
  return {
    editor: `${baseUrl}/dashboard/editor`,
    management: `${baseUrl}/dashboard/management`,
    messages: `${baseUrl}/dashboard/messages`,
    activation: `${baseUrl}/pricing/callback?onboarding=listing&intent=publish`,
    plans: `${baseUrl}/pricing`,
  };
}

// --- Désinscription des rappels --------------------------------------------------------------

// Jeton dérivé du secret des guides d'arrivée, avec un préfixe propre à cet usage.
function signUnsubscribe(userId: string): string {
  return createHmac('sha256', env.BOOKING_GUIDE_ACCESS_SECRET)
    .update(`email-reminders-opt-out:${userId}`)
    .digest('hex')
    .slice(0, 32);
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  const expected = Buffer.from(signUnsubscribe(userId));
  const received = Buffer.from(token);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function buildUnsubscribeUrl(userId: string, baseUrl = resolvePublicBaseUrl()): string {
  const params = new URLSearchParams({ u: userId, t: signUnsubscribe(userId) });
  return `${baseUrl}/api/${env.API_PREFIX}/notifications/unsubscribe?${params}`;
}

// --- Destinataire et envoi -------------------------------------------------------------------

export type HostRecipient = Pick<User, 'id' | 'email' | 'firstName' | 'deletedAt' | 'emailRemindersOptOutAt'>;

const HOST_RECIPIENT_SELECT = {
  id: true,
  email: true,
  firstName: true,
  deletedAt: true,
  emailRemindersOptOutAt: true,
} as const;

export function hostFirstName(host: HostRecipient): string | null {
  return readString(host.firstName);
}

async function loadListingHost(prisma: PrismaClient, listingId: string) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, core: true, owner: { select: HOST_RECIPIENT_SELECT } },
  });
  if (!listing?.owner) return null;
  return {
    host: listing.owner,
    listingTitle: readString(asObject(listing.core).title) ?? 'Votre annonce',
  };
}

export type HostEmailClaim = { dedupeKey: string; refId?: string | null };

export type DeliverHostEmailInput = {
  host: HostRecipient;
  kind: HostEmailKind;
  /** Une clé par événement couvert (un rappel groupé couvre plusieurs annonces). */
  claims: HostEmailClaim[];
  email: RenderedEmail;
  context?: Record<string, unknown>;
};

/** Hôte joignable pour ce type d'e-mail (compte actif, adresse connue, rappels acceptés). */
export function canEmailHost(host: HostRecipient, kind: HostEmailKind): boolean {
  if (host.deletedAt || !readString(host.email)) return false;
  return !(REMINDER_KINDS.has(kind) && host.emailRemindersOptOutAt);
}

/** Pose les clés : renvoie celles obtenues (vide si l'événement a déjà été traité). */
async function claimKeys(prisma: PrismaClient, input: Pick<DeliverHostEmailInput, 'host' | 'kind' | 'claims'>): Promise<string[]> {
  const claimed: string[] = [];
  for (const claim of input.claims) {
    try {
      await prisma.hostNotification.create({
        data: { userId: input.host.id, kind: input.kind, dedupeKey: claim.dedupeKey, refId: claim.refId ?? null },
      });
      claimed.push(claim.dedupeKey);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  return claimed;
}

async function releaseKeys(prisma: PrismaClient, keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await prisma.hostNotification.deleteMany({ where: { dedupeKey: { in: keys } } });
}

/**
 * Envoie un e-mail à un hôte s'il ne l'a pas déjà reçu. Renvoie `true` si l'e-mail est parti.
 * Pour un rappel groupé, seules les clés pas encore posées comptent : si toutes l'étaient, rien ne part.
 */
export async function deliverHostEmail(prisma: PrismaClient, input: DeliverHostEmailInput): Promise<boolean> {
  if (!isMailerConfigured() || !canEmailHost(input.host, input.kind)) return false;

  const claimed = await claimKeys(prisma, input);
  if (claimed.length === 0) return false;

  const unsubscribe = REMINDER_KINDS.has(input.kind) ? buildUnsubscribeUrl(input.host.id) : null;
  const result = await sendMail({
    to: input.host.email as string,
    ...input.email,
    replyTo: SUPPORT_EMAIL,
    tags: ['hote', input.kind],
    ...(unsubscribe
      ? { headers: { 'List-Unsubscribe': `<${unsubscribe}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }
      : {}),
    context: { ...input.context, userId: input.host.id, email: `host_${input.kind}` },
  });

  if (!result.ok) await releaseKeys(prisma, claimed);
  return result.ok;
}

/** Variante « fire-and-forget » : toute erreur est journalisée, jamais remontée. */
async function safely(label: string, context: Record<string, unknown>, run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (error) {
    console.error(`[notifications] e-mail hôte non envoyé (${label})`, { ...context, error });
  }
}

function readGuestContact(contact: Record<string, unknown>): GuestContact {
  return { email: readString(contact.email), phone: readString(contact.phone) };
}

// --- Événements : réservations ---------------------------------------------------------------

export async function notifyHostBookingReceived(
  prisma: PrismaClient,
  input: { access: BookingNotificationContext; guests?: Record<string, unknown> },
): Promise<void> {
  const { access } = input;
  const context = { reservationId: access.reservationId, listingId: access.listingId };
  await safely('booking_received', context, async () => {
    const owner = await loadListingHost(prisma, access.listingId);
    if (!owner) return;

    const amounts = readBookingAmounts(access.payment);
    const email = buildHostBookingReceivedEmail({
      hostFirstName: hostFirstName(owner.host),
      listingTitle: owner.listingTitle,
      guestName: access.guestName,
      startDate: access.startDate,
      endDate: access.endDate,
      nights: Math.max(1, Math.round(access.nights)),
      guests: readGuestsBreakdown(input.guests ?? {}),
      contact: readGuestContact(access.reservationContact),
      currency: amounts.currency,
      total: amounts.total,
      paidNow: amounts.paidNow,
      balance: amounts.balance,
      balanceMode: amounts.balanceMode,
      balanceDueDate: parseIsoDate(amounts.balanceDueDateISO),
      travellerMessage: readString(access.message),
      managementUrl: buildHostLinks().management,
    });

    await deliverHostEmail(prisma, {
      host: owner.host,
      kind: 'booking_received',
      claims: [{ dedupeKey: `booking_received:${access.reservationId}`, refId: access.reservationId }],
      email,
      context,
    });
  });
}

export async function notifyHostBookingCanceled(
  prisma: PrismaClient,
  input: {
    access: BookingNotificationContext;
    canceledBy: 'guest' | 'host';
    chargedAmountMinor: number;
    refundedAmountMinor: number;
    retainedAmountMinor: number;
    reason: string | null;
  },
): Promise<void> {
  const { access } = input;
  const context = { reservationId: access.reservationId, listingId: access.listingId };
  await safely('booking_canceled', context, async () => {
    const owner = await loadListingHost(prisma, access.listingId);
    if (!owner) return;

    const email = buildHostBookingCanceledEmail({
      hostFirstName: hostFirstName(owner.host),
      listingTitle: owner.listingTitle,
      guestName: access.guestName,
      startDate: access.startDate,
      endDate: access.endDate,
      nights: Math.max(1, Math.round(access.nights)),
      canceledBy: input.canceledBy,
      currency: readBookingAmounts(access.payment).currency,
      chargedAmount: Math.max(0, input.chargedAmountMinor) / 100,
      refundedAmount: Math.max(0, input.refundedAmountMinor) / 100,
      retainedAmount: Math.max(0, input.retainedAmountMinor) / 100,
      reason: readString(input.reason),
      managementUrl: buildHostLinks().management,
    });

    await deliverHostEmail(prisma, {
      host: owner.host,
      kind: 'booking_canceled',
      claims: [{ dedupeKey: `booking_canceled:${access.reservationId}`, refId: access.reservationId }],
      email,
      context,
    });
  });
}

export async function notifyHostGuestMessage(
  prisma: PrismaClient,
  input: { messageId: string; conversationId: string; listingId: string; reservationId: string | null; body: string },
): Promise<void> {
  const context = { conversationId: input.conversationId, listingId: input.listingId };
  await safely('guest_message', context, async () => {
    const recent = await prisma.hostNotification.findFirst({
      where: {
        kind: 'guest_message',
        refId: input.conversationId,
        createdAt: { gt: new Date(Date.now() - GUEST_MESSAGE_THROTTLE_MS) },
      },
      select: { id: true },
    });
    if (recent) return;

    const owner = await loadListingHost(prisma, input.listingId);
    if (!owner) return;

    const reservation = input.reservationId
      ? await prisma.reservation.findUnique({
          where: { id: input.reservationId },
          select: { guestName: true, startDate: true, endDate: true },
        })
      : null;

    const excerpt = input.body.length > GUEST_MESSAGE_EXCERPT_MAX
      ? `${input.body.slice(0, GUEST_MESSAGE_EXCERPT_MAX).trimEnd()}…`
      : input.body;

    const email = buildHostGuestMessageEmail({
      hostFirstName: hostFirstName(owner.host),
      guestName: readString(reservation?.guestName) ?? 'Un voyageur',
      listingTitle: owner.listingTitle,
      excerpt,
      stay: reservation ? { startDate: reservation.startDate, endDate: reservation.endDate } : null,
      messagesUrl: buildHostLinks().messages,
    });

    await deliverHostEmail(prisma, {
      host: owner.host,
      kind: 'guest_message',
      claims: [{ dedupeKey: `guest_message:${input.messageId}`, refId: input.conversationId }],
      email,
      context,
    });
  });
}

export async function notifyHostReviewReceived(
  prisma: PrismaClient,
  input: { listingId: string; reservationId: string; author: string; rating: number; text: string; listingUrl: string | null },
): Promise<void> {
  const context = { reservationId: input.reservationId, listingId: input.listingId };
  await safely('review_received', context, async () => {
    const owner = await loadListingHost(prisma, input.listingId);
    if (!owner) return;

    const email = buildHostReviewReceivedEmail({
      hostFirstName: hostFirstName(owner.host),
      listingTitle: owner.listingTitle,
      author: input.author,
      rating: input.rating,
      text: input.text,
      listingUrl: input.listingUrl ?? buildHostLinks().editor,
    });

    await deliverHostEmail(prisma, {
      host: owner.host,
      kind: 'review_received',
      claims: [{ dedupeKey: `review_received:${input.reservationId}`, refId: input.listingId }],
      email,
      context,
    });
  });
}

// --- Événements : paiements (webhooks Stripe des comptes connectés) -------------------------

type WebhookPayment = { id: string; listingId: string; reservationId: string | null; currency: string };

async function loadPaymentGuest(prisma: PrismaClient, reservationId: string | null) {
  if (!reservationId) return null;
  return prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { guestName: true, contact: true },
  });
}

export async function notifyHostDisputeOpened(
  prisma: PrismaClient,
  input: { payment: WebhookPayment; disputeId: string; amountMinor: number; reason: string | null; evidenceDueBy: Date | null },
): Promise<void> {
  const context = { paymentId: input.payment.id, listingId: input.payment.listingId, disputeId: input.disputeId };
  await safely('dispute_opened', context, async () => {
    const owner = await loadListingHost(prisma, input.payment.listingId);
    if (!owner) return;
    const reservation = await loadPaymentGuest(prisma, input.payment.reservationId);

    const email = buildHostDisputeEmail({
      hostFirstName: hostFirstName(owner.host),
      listingTitle: owner.listingTitle,
      guestName: readString(reservation?.guestName),
      amountMinor: input.amountMinor,
      currency: input.payment.currency,
      reason: input.reason,
      evidenceDueBy: input.evidenceDueBy,
    });

    await deliverHostEmail(prisma, {
      host: owner.host,
      kind: 'dispute_opened',
      claims: [{ dedupeKey: `dispute_opened:${input.disputeId}`, refId: input.payment.id }],
      email,
      context,
    });
  });
}

export async function notifyHostRefundFailed(
  prisma: PrismaClient,
  input: { payment: WebhookPayment; refundId: string; amountMinor: number },
): Promise<void> {
  const context = { paymentId: input.payment.id, listingId: input.payment.listingId, refundId: input.refundId };
  await safely('refund_failed', context, async () => {
    const owner = await loadListingHost(prisma, input.payment.listingId);
    if (!owner) return;
    const reservation = await loadPaymentGuest(prisma, input.payment.reservationId);

    const email = buildHostRefundFailedEmail({
      hostFirstName: hostFirstName(owner.host),
      listingTitle: owner.listingTitle,
      guestName: readString(reservation?.guestName),
      amountMinor: input.amountMinor,
      currency: input.payment.currency,
      contact: readGuestContact(asObject(reservation?.contact)),
      messagesUrl: buildHostLinks().messages,
    });

    await deliverHostEmail(prisma, {
      host: owner.host,
      kind: 'refund_failed',
      claims: [{ dedupeKey: `refund_failed:${input.refundId}`, refId: input.payment.id }],
      email,
      context,
    });
  });
}

// --- Événements : annonces -------------------------------------------------------------------

/**
 * Après la publication d'une annonce : « votre annonce est en ligne » (une fois par annonce) et,
 * si elle prend la dernière place de l'offre, la limite atteinte — dans le même e-mail quand les
 * deux arrivent ensemble, sinon dans un e-mail à part (une fois par niveau de limite).
 */
export async function notifyHostListingPublished(
  prisma: PrismaClient,
  input: {
    listingId: string;
    publicUrl: string;
    allowance: { planCode: unknown; activeListings: number; maxActiveListings: number } | null;
  },
): Promise<void> {
  const context = { listingId: input.listingId };
  await safely('listing_published', context, async () => {
    const owner = await loadListingHost(prisma, input.listingId);
    if (!owner) return;

    const { allowance } = input;
    const limitReached = allowance && allowance.maxActiveListings > 0 && allowance.activeListings >= allowance.maxActiveListings
      ? describeListingAllowance(allowance.planCode, allowance.activeListings, allowance.maxActiveListings)
      : null;
    const limitClaim = limitReached
      ? { dedupeKey: `listing_limit_reached:${owner.host.id}:${limitReached.maxActiveListings}`, refId: input.listingId }
      : null;
    const links = buildHostLinks();

    const alreadyAnnounced = await prisma.hostNotification.findUnique({
      where: { dedupeKey: `listing_published:${input.listingId}` },
      select: { id: true },
    });

    if (!alreadyAnnounced) {
      const limitAlreadySent = limitClaim
        ? await prisma.hostNotification.findUnique({ where: { dedupeKey: limitClaim.dedupeKey }, select: { id: true } })
        : null;
      const includeLimit = limitReached && !limitAlreadySent ? limitReached : null;
      await deliverHostEmail(prisma, {
        host: owner.host,
        kind: 'listing_published',
        claims: [
          { dedupeKey: `listing_published:${input.listingId}`, refId: input.listingId },
          ...(includeLimit && limitClaim ? [limitClaim] : []),
        ],
        email: buildHostListingPublishedEmail({
          hostFirstName: hostFirstName(owner.host),
          listingTitle: owner.listingTitle,
          publicUrl: input.publicUrl,
          limitReached: includeLimit,
          dashboardUrl: links.editor,
        }),
        context,
      });
      return;
    }

    if (limitReached && limitClaim) {
      await deliverHostEmail(prisma, {
        host: owner.host,
        kind: 'listing_limit_reached',
        claims: [limitClaim],
        email: buildHostListingLimitReachedEmail({
          hostFirstName: hostFirstName(owner.host),
          allowance: limitReached,
          dashboardUrl: links.editor,
          unsubscribeUrl: buildUnsubscribeUrl(owner.host.id),
        }),
        context,
      });
    }
  });
}

export const hostNotifications = {
  bookingReceived: notifyHostBookingReceived,
  bookingCanceled: notifyHostBookingCanceled,
  guestMessage: notifyHostGuestMessage,
  reviewReceived: notifyHostReviewReceived,
  disputeOpened: notifyHostDisputeOpened,
  refundFailed: notifyHostRefundFailed,
  listingPublished: notifyHostListingPublished,
} as const;
