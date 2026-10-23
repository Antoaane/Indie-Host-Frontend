import type { PrismaClient } from '@prisma/client';

import { hasAdminAccess } from '../../lib/authRole.js';
import { asObject } from '../../lib/json.js';
import type { RequestAuth } from '../../types/auth.js';
import { upsertUserFromAuth } from '../users/users.repository.js';

/**
 * Marqueur posé sur une section expurgée. Un client qui réenregistre cette vue (session expirée,
 * jeton absent) écraserait les réservations ou le guide : l'API refuse alors l'écriture.
 */
export const PUBLIC_REDACTION_FLAG = 'redactedForPublic';

export type ListingAccess = {
  /** Réservations, coordonnées des voyageurs, guide d'arrivée complet. */
  canReadPrivate: boolean;
  canWrite: boolean;
};

export async function resolveListingAccess(
  prisma: PrismaClient,
  listingId: string,
  auth: RequestAuth | null,
): Promise<ListingAccess | null> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { ownerId: true },
  });

  if (!listing) return null;
  return resolveListingAccessForOwner(prisma, listing.ownerId, auth);
}

export async function resolveListingAccessForOwner(
  prisma: PrismaClient,
  ownerId: string | null,
  auth: RequestAuth | null,
): Promise<ListingAccess> {
  if (hasAdminAccess(auth)) return { canReadPrivate: true, canWrite: true };

  const actor = await upsertUserFromAuth(prisma, auth);
  const isOwner = Boolean(actor && ownerId && ownerId === actor.id);
  // Une annonce sans propriétaire (héritage d'anciennes créations) n'est modifiable que par un
  // admin, qui la transfère au bon compte : aucun parcours ne crée plus d'annonce sans propriétaire
  // (POST /listings exige un compte, l'assistant public reste en mémoire locale).
  return { canReadPrivate: isOwner, canWrite: isOwner };
}

export function isRedactedPatch(patch: Record<string, unknown>): boolean {
  return patch[PUBLIC_REDACTION_FLAG] === true;
}

function readRange(value: unknown): { start: string; end: string } | null {
  const range = asObject(value);
  const start = typeof range.start === 'string' ? range.start.trim() : '';
  const end = typeof range.end === 'string' ? range.end.trim() : '';
  return start && end ? { start, end } : null;
}

function collectRanges(...sources: unknown[]): Array<{ start: string; end: string }> {
  const ranges = new Map<string, { start: string; end: string }>();
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const item of source) {
      const range = readRange(item);
      if (range) ranges.set(`${range.start}__${range.end}`, range);
    }
  }
  return Array.from(ranges.values());
}

/** Vue publique des réservations : les plages occupées, jamais les voyageurs ni leurs clés de guide. */
export function redactBookingsForPublic(bookings: Record<string, unknown>): Record<string, unknown> {
  const { reservations, ...rest } = bookings;

  return {
    ...rest,
    'booked-days': collectRanges(rest['booked-days'], reservations),
    'external-booked-days': collectRanges(rest['external-booked-days']),
    [PUBLIC_REDACTION_FLAG]: true,
  };
}

/** Vue publique du guide d'arrivée : accueil, horaires et règlement intérieur, sans adresse, accès ni Wi-Fi. */
export function redactArrivalForPublic(arrival: Record<string, unknown>): Record<string, unknown> {
  const practical = asObject(arrival.practical);
  const access = asObject(practical.access);

  return {
    intro: asObject(arrival.intro),
    practical: {
      access: {
        checkIn: typeof access.checkIn === 'string' ? access.checkIn : '',
        checkOut: typeof access.checkOut === 'string' ? access.checkOut : '',
      },
      rules: typeof practical.rules === 'string' ? practical.rules : '',
    },
    [PUBLIC_REDACTION_FLAG]: true,
  };
}

export function redactListingSectionForPublic(
  resource: string,
  value: Record<string, unknown>,
): Record<string, unknown> {
  if (resource === 'bookings') return redactBookingsForPublic(value);
  if (resource === 'arrival') return redactArrivalForPublic(value);
  return value;
}
