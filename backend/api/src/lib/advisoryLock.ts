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
  // $executeRaw, pas $queryRaw : la fonction renvoie `void`, que l'adaptateur pg de Prisma 7 refuse
  // de lire (« UnsupportedNativeDataType »). Toute réservation échouait.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${LISTING_BOOKING_LOCK_NAMESPACE}::text), hashtext(${listingId}::text))`;
}

const LISTING_CALENDAR_SYNC_LOCK_NAMESPACE = 'indiehost.listing_calendar_sync';

/**
 * Même principe pour le remplacement des événements importés d'une annonce : la tâche planifiée, la
 * consultation de l'annonce et « Forcer une synchro » peuvent relire le même calendrier au même
 * moment. Sans verrou, les deux remplacements se croisent et le second bute sur la contrainte unique
 * (annonce, identifiant d'événement), ce qui affiche à tort « calendrier déjà importé ».
 */
export async function acquireListingCalendarSyncLock(tx: Prisma.TransactionClient, listingId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${LISTING_CALENDAR_SYNC_LOCK_NAMESPACE}::text), hashtext(${listingId}::text))`;
}
