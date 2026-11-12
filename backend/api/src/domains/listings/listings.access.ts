import { createHmac } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';

import { env } from '../../config/env.js';
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

// Position publique d'un logement : déplacée de 60 à 150 m dans une direction tirée d'une clé
// secrète, puis arrondie à 4 décimales (≈ 10 m). La carte publique (`Map.vue`) dessine un cercle de
// 300 m autour d'un point qu'elle décale encore de 120 m au plus : 150 + 10 + 120 < 300, le logement
// reste dans le cercle. Le décalage dépend de l'annonce seule : déplacer l'épingle ne le révèle pas.
const PUBLIC_POSITION_MIN_OFFSET_METERS = 60;
const PUBLIC_POSITION_MAX_OFFSET_METERS = 150;
const METERS_PER_DEGREE_LATITUDE = 111_320;

function readCoordinate(value: unknown): number | null {
  const parsed = typeof value === 'string' && value.trim() ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
}

function roundCoordinate(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function approximatePublicPosition(
  listingId: string,
  latitude: number,
  longitude: number,
): { latitude: number; longitude: number } {
  const digest = createHmac('sha256', env.BOOKING_GUIDE_ACCESS_SECRET)
    .update(`public-position|${listingId}`)
    .digest();
  const angle = (digest.readUInt32BE(0) / 0x1_0000_0000) * 2 * Math.PI;
  const distance = PUBLIC_POSITION_MIN_OFFSET_METERS
    + (digest.readUInt32BE(4) / 0x1_0000_0000) * (PUBLIC_POSITION_MAX_OFFSET_METERS - PUBLIC_POSITION_MIN_OFFSET_METERS);
  const metersPerDegreeLongitude = METERS_PER_DEGREE_LATITUDE * Math.max(Math.cos((latitude * Math.PI) / 180), 0.01);

  return {
    latitude: roundCoordinate(latitude + (distance * Math.cos(angle)) / METERS_PER_DEGREE_LATITUDE),
    longitude: roundCoordinate(longitude + (distance * Math.sin(angle)) / metersPerDegreeLongitude),
  };
}

/**
 * Vue publique de `core` : ni l'adresse précise ni la position exacte. Comme sur Airbnb, l'adresse
 * n'est donnée qu'au voyageur, avec sa clé de guide (`getReservationGuideAccess`).
 */
export function redactCoreForPublic(listingId: string, core: Record<string, unknown>): Record<string, unknown> {
  const {
    precise_address: _preciseAddress,
    preciseAddress: _preciseAddressCamel,
    ...rest
  } = core;

  const latitude = readCoordinate(rest.latitude);
  const longitude = readCoordinate(rest.longitude);
  if (latitude !== null && longitude !== null && !(latitude === 0 && longitude === 0)) {
    Object.assign(rest, approximatePublicPosition(listingId, latitude, longitude));
  }

  return { ...rest, [PUBLIC_REDACTION_FLAG]: true };
}

export function redactListingSectionForPublic(
  resource: string,
  value: Record<string, unknown>,
  listingId: string,
): Record<string, unknown> {
  if (resource === 'core') return redactCoreForPublic(listingId, value);
  if (resource === 'bookings') return redactBookingsForPublic(value);
  if (resource === 'arrival') return redactArrivalForPublic(value);
  return value;
}
