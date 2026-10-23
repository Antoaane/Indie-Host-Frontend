import { createHmac } from 'node:crypto';

import { env } from '../config/env.js';
import { asObject } from './json.js';

// Clé d'accès au guide d'arrivée (`rg.<reservationId>.<signature>`), partagée entre les domaines
// bookings (émission) et listings (avis voyageur). La logique doit rester identique à
// `BookingsService.buildGuideAccessKey` / `parseGuideAccessKey`.

const GUIDE_KEY_PATTERN = /^rg\.([a-zA-Z0-9_-]+)\.([a-f0-9]{20})$/;

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function toIsoDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function buildGuideAccessKey(reservationId: string, listingId: string, startDate: Date | null | undefined): string {
  const safeReservationId = reservationId.trim();
  const startISO = startDate ? toIsoDay(startDate) : '';
  const payload = `${safeReservationId}|${listingId.trim()}|${startISO}`;
  const signature = createHmac('sha256', env.BOOKING_GUIDE_ACCESS_SECRET)
    .update(payload)
    .digest('hex')
    .slice(0, 20);
  return `rg.${safeReservationId}.${signature}`;
}

export function parseGuideAccessKey(guideKey: string): { reservationId: string; signature: string } | null {
  const match = guideKey.trim().match(GUIDE_KEY_PATTERN);
  if (!match) return null;

  const reservationId = match[1]?.trim() ?? '';
  const signature = match[2]?.trim() ?? '';
  if (!reservationId || !signature) return null;

  return { reservationId, signature };
}

// Clé stockée dans `Reservation.contact.confirmation` lors de la création de la réservation.
export function readStoredGuideAccessKey(contactRaw: unknown): string | null {
  const confirmation = asObject(asObject(contactRaw).confirmation);
  return readString(confirmation.guideAccessKey)
    ?? readString(confirmation.guideAccessToken)
    ?? readString(confirmation.token);
}

// Vérifie qu'une clé de guide correspond à la réservation : signature recalculée et clé stockée identiques.
export function verifyGuideAccessKey(
  guideKey: string,
  reservation: { id: string; listingId: string; startDate: Date | null | undefined; contact: unknown },
): boolean {
  const safeKey = guideKey.trim();
  if (!safeKey) return false;

  const storedKey = readStoredGuideAccessKey(reservation.contact);
  if (!storedKey) return false;

  const expectedKey = buildGuideAccessKey(reservation.id, reservation.listingId, reservation.startDate);
  return safeKey === expectedKey && storedKey === expectedKey;
}
