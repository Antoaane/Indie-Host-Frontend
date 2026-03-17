import type { PrismaClient } from '@prisma/client';

import { deepMerge, asObject, toNumber } from '../../lib/json.js';
import { buildReservationId } from '../../lib/id.js';
import { toPrismaJson } from '../../lib/prisma.js';

type RawReservation = Record<string, unknown>;

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function extractReservations(bookings: Record<string, unknown>) {
  if (!Array.isArray(bookings.reservations)) return [] as RawReservation[];
  return bookings.reservations.filter((item): item is RawReservation => Boolean(item) && typeof item === 'object');
}

function extractBookedDays(bookings: Record<string, unknown>) {
  if (!Array.isArray(bookings['booked-days'])) return [] as Array<Record<string, unknown>>;
  return bookings['booked-days'].filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
}

function normalizeReservationId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function reservationIdFromRow(row: RawReservation): string | null {
  return normalizeReservationId(row.id);
}

function normalizeDayValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

function appendBookedDayIfMissing(bookedDays: Array<Record<string, unknown>>, start: string, end: string) {
  const hasMatch = bookedDays.some((item) => item.start === start && item.end === end);
  if (hasMatch) return;
  bookedDays.push({ start, end });
}

function extractStripePaymentIntentId(row: RawReservation): string | null {
  const payment = asObject(row.payment);
  const stripe = asObject(payment.stripe);
  const paymentIntentId = typeof stripe.paymentIntentId === 'string' ? stripe.paymentIntentId.trim() : '';
  return paymentIntentId || null;
}

export class BookingsService {
  constructor(private readonly prisma: PrismaClient) {}

  private async reservationIdUsedByAnotherListing(reservationId: string, listingId: string): Promise<boolean> {
    const existing = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { listingId: true },
    });

    if (!existing) return false;
    return existing.listingId !== listingId;
  }

  private async ensureReservationId(preferredId: string | null, listingId: string, usedReservationIds: Set<string> = new Set()): Promise<string> {
    const requestedId = preferredId ?? buildReservationId(listingId);

    let candidate = requestedId;
    let attempts = 0;

    while (attempts < 20) {
      const alreadyUsedInListing = usedReservationIds.has(candidate);
      const belongsToOtherListing = await this.reservationIdUsedByAnotherListing(candidate, listingId);

      if (!alreadyUsedInListing && !belongsToOtherListing) {
        return candidate;
      }

      candidate = buildReservationId(listingId);
      attempts += 1;
    }

    return `${buildReservationId(listingId)}-${Date.now().toString(36)}`;
  }

  async getListingBookings(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, bookings: true },
    });

    if (!listing) return null;

    return asObject(listing.bookings, {
      price: 0,
      fees: [],
      'booked-days': [],
      reservations: [],
    });
  }

  private async persistReservation(row: RawReservation, listingId: string) {
    const reservationId = normalizeReservationId(row.id) ?? buildReservationId(listingId);
    const guestName = typeof row.guestName === 'string' ? row.guestName : 'Voyageur';
    const startDate = parseDate(row.start) ?? new Date();
    const endDate = parseDate(row.end) ?? startDate;
    const payload = {
      guestName,
      guestAvatar: typeof row.guestAvatar === 'string' ? row.guestAvatar : null,
      startDate,
      endDate,
      nights: toNumber(row.nights, 1),
      message: typeof row.message === 'string' ? row.message : null,
      internalNote: typeof row.internalNote === 'string' ? row.internalNote : null,
      guests: toPrismaJson(asObject(row.guests, {})),
      payment: toPrismaJson(asObject(row.payment, {})),
      contact: toPrismaJson(asObject(row.contact, {})),
      messaging: toPrismaJson(asObject(row.messaging, {})),
    };

    const existing = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: {
        id: true,
        listingId: true,
      },
    });

    let persistedReservationId = reservationId;

    if (existing && existing.listingId === listingId) {
      await this.prisma.reservation.update({
        where: { id: reservationId },
        data: payload,
      });
    } else {
      if (existing && existing.listingId !== listingId) {
        persistedReservationId = await this.ensureReservationId(null, listingId, new Set([
          reservationId,
        ]));
      }

      await this.prisma.reservation.create({
        data: {
          id: persistedReservationId,
          listingId,
          ...payload,
        },
      });
    }

    const stripePaymentIntentId = extractStripePaymentIntentId(row);
    if (stripePaymentIntentId) {
      await this.prisma.payment.updateMany({
        where: {
          stripePaymentIntentId,
          listingId,
        },
        data: {
          reservationId: persistedReservationId,
        },
      });
    }

    return persistedReservationId;
  }

  async createBooking(input: Record<string, unknown>) {
    const listingId = String(input.listingId ?? '').trim();
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        bookings: true,
      },
    });

    if (!listing) return null;

    const bookings = asObject(listing.bookings, {
      price: 0,
      fees: [],
      'booked-days': [],
      reservations: [],
    });

    const existingReservations = extractReservations(bookings);
    const bookedDays = extractBookedDays(bookings);
    const usedReservationIds = new Set(
      existingReservations
        .map((reservation) => reservationIdFromRow(reservation))
        .filter((value): value is string => Boolean(value)),
    );
    const requestedReservationId = normalizeReservationId(input.id);
    const safeReservationId = await this.ensureReservationId(requestedReservationId, listingId, usedReservationIds);
    const reservations = existingReservations.filter((reservation) => reservationIdFromRow(reservation) !== safeReservationId);

    const reservation: RawReservation = {
      id: safeReservationId,
      start: input.start,
      end: input.end,
      nights: input.nights,
      guestName: input.guestName,
      guestAvatar: input.guestAvatar,
      message: input.message,
      internalNote: input.internalNote,
      guests: asObject(input.guests, {}),
      payment: asObject(input.payment, {}),
      contact: asObject(input.contact, {}),
      createdAt: typeof input.createdAt === 'string' ? input.createdAt : new Date().toISOString(),
      messaging: asObject(input.messaging, {}),
    };

    reservations.unshift(reservation);

    const start = normalizeDayValue(input.start);
    const end = normalizeDayValue(input.end);

    if (start && end) {
      appendBookedDayIfMissing(bookedDays, start, end);
    }

    const nextBookings = {
      ...bookings,
      reservations,
      'booked-days': bookedDays,
    };

    await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        bookings: toPrismaJson(nextBookings),
      },
    });

    const reservationId = await this.persistReservation(reservation, listingId);
    if (reservationId !== safeReservationId) {
      reservations[0] = {
        ...reservations[0],
        id: reservationId,
      };

      const syncedBookings = {
        ...nextBookings,
        reservations,
      };

      await this.prisma.listing.update({
        where: { id: listingId },
        data: {
          bookings: toPrismaJson(syncedBookings),
        },
      });

      return {
        reservationId,
        listingId,
        bookings: syncedBookings,
      };
    }

    return {
      reservationId,
      listingId,
      bookings: nextBookings,
    };
  }

  async updateBooking(reservationId: string, listingId: string, patch: Record<string, unknown>) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        bookings: true,
      },
    });

    if (!listing) return null;

    const bookings = asObject(listing.bookings, {
      price: 0,
      fees: [],
      'booked-days': [],
      reservations: [],
    });

    const reservations = extractReservations(bookings);
    const index = reservations.findIndex((item) => reservationIdFromRow(item) === reservationId);

    if (index < 0) return 'not_found' as const;

    const usedReservationIds = new Set(
      reservations
        .filter((_, itemIndex) => itemIndex !== index)
        .map((reservation) => reservationIdFromRow(reservation))
        .filter((value): value is string => Boolean(value)),
    );
    const safeReservationId = await this.ensureReservationId(reservationId, listingId, usedReservationIds);

    const updatedReservation = deepMerge(reservations[index] ?? {}, patch) as RawReservation;
    updatedReservation.id = safeReservationId;
    reservations[index] = updatedReservation;

    const nextBookings = {
      ...bookings,
      reservations,
    };

    await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        bookings: toPrismaJson(nextBookings),
      },
    });

    const persistedReservationId = await this.persistReservation(updatedReservation, listingId);
    if (persistedReservationId !== safeReservationId) {
      updatedReservation.id = persistedReservationId;
      reservations[index] = updatedReservation;

      const syncedBookings = {
        ...nextBookings,
        reservations,
      };

      await this.prisma.listing.update({
        where: { id: listingId },
        data: {
          bookings: toPrismaJson(syncedBookings),
        },
      });
    }

    return updatedReservation;
  }
}
