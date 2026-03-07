import type { CalendarSync, PrismaClient } from '@prisma/client';
import ical from 'ical-generator';
import { ICalCalendarMethod } from 'ical-generator';
import { ICalEventStatus } from 'ical-generator';
import * as nodeIcal from 'node-ical';

import { env } from '../../config/env.js';
import { asObject } from '../../lib/json.js';

type ImportCalendarInput = {
  name?: string;
  url?: string;
  ical?: string;
  timezone?: string;
};

function safeDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function normalizeEventStatus(status?: string | null): string {
  const normalized = (status ?? '').trim().toLowerCase();
  return normalized || 'confirmed';
}

function toIcalStatus(status?: string | null): ICalEventStatus {
  const normalized = normalizeEventStatus(status).toLowerCase();
  if (normalized === 'cancelled' || normalized === 'canceled') return ICalEventStatus.CANCELLED;
  if (normalized === 'tentative') return ICalEventStatus.TENTATIVE;
  return ICalEventStatus.CONFIRMED;
}

export class CalendarService {
  constructor(private readonly prisma: PrismaClient) {}

  private async resolveListingBookings(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        bookings: true,
      },
    });

    if (!listing) return null;

    return asObject(listing.bookings, {
      reservations: [],
      'booked-days': [],
    });
  }

  private parseReservationEvents(listingId: string, bookings: Record<string, unknown>) {
    const events: Array<{
      id: string;
      start: Date;
      end: Date;
      summary: string;
      description: string;
      status: string;
    }> = [];

    const reservations = Array.isArray(bookings.reservations)
      ? bookings.reservations.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      : [];

    if (reservations.length) {
      for (const reservation of reservations) {
        const id = typeof reservation.id === 'string' && reservation.id.trim()
          ? reservation.id.trim()
          : `reservation-${events.length + 1}`;
        const start = safeDate(reservation.start);
        const end = safeDate(reservation.end);
        if (!start || !end) continue;

        const guestName = typeof reservation.guestName === 'string' ? reservation.guestName : 'Voyageur';

        events.push({
          id,
          start,
          end,
          summary: `Reservation ${guestName}`,
          description: typeof reservation.message === 'string' ? reservation.message : '',
          status: 'confirmed',
        });
      }

      return events;
    }

    const bookedDays = Array.isArray(bookings['booked-days'])
      ? bookings['booked-days'].filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      : [];

    for (const [index, period] of bookedDays.entries()) {
      const start = safeDate(period.start);
      const end = safeDate(period.end);
      if (!start || !end) continue;

      events.push({
        id: `booked-${listingId}-${index}`,
        start,
        end,
        summary: 'Reserve',
        description: '',
        status: 'confirmed',
      });
    }

    return events;
  }

  async exportListingCalendar(listingId: string) {
    const bookings = await this.resolveListingBookings(listingId);
    if (!bookings) return null;

    const importedEvents = await this.prisma.calendarEvent.findMany({
      where: {
        listingId,
      },
      orderBy: {
        startDate: 'asc',
      },
    });

    const reservationEvents = this.parseReservationEvents(listingId, bookings);

    const calendar = ical({
      name: `IndieHost ${listingId}`,
      prodId: {
        company: 'IndieHost',
        product: env.ICAL_EXPORT_DEFAULT_PRODID,
      },
      timezone: 'UTC',
    });

    calendar.method(ICalCalendarMethod.PUBLISH);

    for (const event of reservationEvents) {
      calendar.createEvent({
        id: event.id,
        start: event.start,
        end: event.end,
        summary: event.summary,
        description: event.description,
        status: toIcalStatus(event.status),
      });
    }

    for (const event of importedEvents) {
      calendar.createEvent({
        id: event.externalUid ?? event.id,
        start: event.startDate,
        end: event.endDate,
        summary: event.summary ?? 'Imported event',
        description: event.description ?? undefined,
        status: toIcalStatus(event.status),
      });
    }

    return calendar.toString();
  }

  private async parseIncomingIcal(input: ImportCalendarInput): Promise<string> {
    if (input.ical?.trim()) return input.ical;

    if (!input.url) {
      throw new Error('No iCal content or source URL provided.');
    }

    const response = await fetch(input.url, {
      method: 'GET',
      headers: {
        Accept: 'text/calendar,text/plain,*/*',
      },
    });

    if (!response.ok) {
      throw new Error(`Unable to fetch iCal source (${response.status}).`);
    }

    return response.text();
  }

  private async replaceSyncEvents(listingId: string, sync: CalendarSync, sourceIcal: string) {
    const parsed = nodeIcal.parseICS(sourceIcal);

    await this.prisma.calendarEvent.deleteMany({
      where: {
        listingId,
        calendarSyncId: sync.id,
      },
    });

    const data: Array<{
      listingId: string;
      calendarSyncId: string;
      externalUid: string | null;
      source: string;
      startDate: Date;
      endDate: Date;
      summary: string | null;
      description: string | null;
      status: string;
    }> = [];

    for (const value of Object.values(parsed)) {
      if (!value || typeof value !== 'object') continue;
      if ((value as { type?: string }).type !== 'VEVENT') continue;

      const event = value as nodeIcal.VEvent;
      const startDate = safeDate(event.start);
      const endDate = safeDate(event.end);
      if (!startDate || !endDate) continue;

      data.push({
        listingId,
        calendarSyncId: sync.id,
        externalUid: typeof event.uid === 'string' ? event.uid : null,
        source: 'ical_import',
        startDate,
        endDate,
        summary: typeof event.summary === 'string' ? event.summary : null,
        description: typeof event.description === 'string' ? event.description : null,
        status: normalizeEventStatus(event.status),
      });
    }

    if (data.length) {
      await this.prisma.calendarEvent.createMany({ data });
    }

    await this.prisma.calendarSync.update({
      where: { id: sync.id },
      data: {
        rawIcs: sourceIcal,
        lastStatus: 'ok',
        lastError: null,
        lastSyncedAt: new Date(),
      },
    });

    return {
      importedEvents: data.length,
      syncId: sync.id,
    };
  }

  async importCalendar(listingId: string, input: ImportCalendarInput) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true },
    });

    if (!listing) return null;

    const sourceIcal = await this.parseIncomingIcal(input);

    const sync = await this.prisma.calendarSync.create({
      data: {
        listingId,
        name: input.name ?? null,
        sourceUrl: input.url ?? null,
        rawIcs: sourceIcal,
        timezone: input.timezone ?? null,
        lastStatus: 'pending',
      },
    });

    return this.replaceSyncEvents(listingId, sync, sourceIcal);
  }

  async syncCalendarSource(listingId: string, syncId: string) {
    const sync = await this.prisma.calendarSync.findFirst({
      where: {
        id: syncId,
        listingId,
      },
    });

    if (!sync) return null;
    if (!sync.sourceUrl) {
      throw new Error('This sync source has no URL and cannot be refreshed automatically.');
    }

    const sourceIcal = await this.parseIncomingIcal({
      url: sync.sourceUrl,
    });

    return this.replaceSyncEvents(listingId, sync, sourceIcal);
  }

  async listCalendarSyncSources(listingId: string) {
    return this.prisma.calendarSync.findMany({
      where: {
        listingId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
