import type { Prisma } from '@prisma/client';

// Espace de noms des verrous consultatifs Postgres pris sur une annonce : évite toute collision
// avec un autre usage de pg_advisory_xact_lock dans l'application.
const LISTING_BOOKING_LOCK_NAMESPACE = 'indiehost.listing_booking';

/**
 * Verrou consultatif Postgres limité à la transaction courante, clé sur l'annonce : deux
 * créations de réservation sur la même annonce s'exécutent l'une après l'autre. Le verrou est
 * libéré automatiquement au commit ou au rollback ; tout ce qui sert à décider (disponibilité,
 * paiement rattaché) doit être lu via `tx` après cet appel.
 */
export async function acquireListingBookingLock(tx: Prisma.TransactionClient, listingId: string): Promise<void> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${LISTING_BOOKING_LOCK_NAMESPACE}::text), hashtext(${listingId}::text))`;
}
