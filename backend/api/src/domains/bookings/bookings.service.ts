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

export class BookingsService {
  constructor(private readonly prisma: PrismaClient) {}

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
    const reservationId = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : buildReservationId(listingId);
    const guestName = typeof row.guestName === 'string' ? row.guestName : 'Voyageur';
    const startDate = parseDate(row.start) ?? new Date();
    const endDate = parseDate(row.end) ?? startDate;

    await this.prisma.reservation.upsert({
      where: { id: reservationId },
      update: {
        listingId,
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
      },
      create: {
        id: reservationId,
        listingId,
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
      },
    });

    return reservationId;
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

    const reservations = extractReservations(bookings);
    const bookedDays = extractBookedDays(bookings);

    const reservation: RawReservation = {
      id: typeof input.id === 'string' && input.id.trim() ? input.id.trim() : buildReservationId(listingId),
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

    const start = typeof input.start === 'string' ? input.start : '';
    const end = typeof input.end === 'string' ? input.end : '';

    if (start && end) {
      bookedDays.push({ start, end });
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
    const index = reservations.findIndex((item) => item.id === reservationId);

    if (index < 0) return 'not_found' as const;

    const updatedReservation = deepMerge(reservations[index] ?? {}, patch) as RawReservation;
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

    await this.persistReservation(updatedReservation, listingId);

    return updatedReservation;
  }
}
