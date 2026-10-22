import type { CalendarSync, PrismaClient } from '@prisma/client';
import ical from 'ical-generator';
import { ICalCalendarMethod, ICalEventStatus } from 'ical-generator';
import * as nodeIcal from 'node-ical';

import { env } from '../../config/env.js';
import { asObject } from '../../lib/json.js';
import { toPrismaJson } from '../../lib/prisma.js';

type ImportCalendarInput = {
  name?: string;
  url?: string;
  ical?: string;
  timezone?: string;
};

type DayRange = {
  start: string;
  end: string;
};

type SourceSyncOutcomeStatus = 'synced' | 'throttled' | 'failed' | 'skipped';

type SourceSyncOutcome = {
  syncId: string;
  name: string | null;
  sourceUrl: string | null;
  status: SourceSyncOutcomeStatus;
  changed: boolean;
  importedEvents: number;
  blockingEvents: number;
  lastSyncedAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  isFresh: boolean;
  staleAfter: string | null;
};

type ReplaceSyncEventsResult = {
  importedEvents: number;
  blockingEvents: number;
  changed: boolean;
};

type StoredExternalEvent = {
  listingId: string;
  calendarSyncId: string | null;
  externalUid: string | null;
  source: string;
  startDate: Date;
  endDate: Date;
  summary: string | null;
  description: string | null;
  status: string;
};

const EXTERNAL_SOURCE = 'ical_import';
const SYNC_STATUS_OK = 'ok';
const SYNC_STATUS_ERROR = 'error';
const SYNC_STATUS_SYNCING = 'syncing';

function safeDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizeDayValue(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toIsoDay(value);
  }

  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return toIsoDay(parsed);
}

function addOneDay(day: string): string {
  const base = new Date(`${day}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + 1);
  return toIsoDay(base);
}

function normalizeDayRange(startValue: unknown, endValue: unknown, allowZeroLength = false): DayRange | null {
  const start = normalizeDayValue(startValue);
  const end = normalizeDayValue(endValue);
  if (!start || !end) return null;

  if (end > start) {
    return { start, end };
  }

  if (allowZeroLength && end === start) {
    return { start, end: addOneDay(end) };
  }

  return null;
}

function rangeKey(range: DayRange): string {
  return `${range.start}__${range.end}`;
}

function sortRanges(ranges: DayRange[]): DayRange[] {
  return [...ranges].sort((a, b) => {
    if (a.start !== b.start) return a.start.localeCompare(b.start);
    return a.end.localeCompare(b.end);
  });
}

function uniqueSortedRanges(ranges: DayRange[]): DayRange[] {
  const map = new Map<string, DayRange>();
  for (const range of ranges) {
    map.set(rangeKey(range), range);
  }
  return sortRanges(Array.from(map.values()));
}

function areRangesEqual(a: DayRange[], b: DayRange[]): boolean {
  if (a.length !== b.length) return false;

  for (let index = 0; index < a.length; index += 1) {
    if (a[index]?.start !== b[index]?.start) return false;
    if (a[index]?.end !== b[index]?.end) return false;
  }

  return true;
}

function normalizeEventStatus(status?: string | null): string {
  const normalized = (status ?? '').trim().toLowerCase();
  return normalized || 'confirmed';
}

function isBlockingEventStatus(status?: string | null): boolean {
  const normalized = normalizeEventStatus(status);
  return normalized !== 'cancelled' && normalized !== 'canceled';
}

function toIcalStatus(status?: string | null): ICalEventStatus {
  const normalized = normalizeEventStatus(status).toLowerCase();
  if (normalized === 'cancelled' || normalized === 'canceled') return ICalEventStatus.CANCELLED;
  if (normalized === 'tentative') return ICalEventStatus.TENTATIVE;
  return ICalEventStatus.CONFIRMED;
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message) return message.slice(0, 500);
    return 'Unknown iCal sync error.';
  }

  return 'Unknown iCal sync error.';
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = (error as { name?: unknown }).name;
  return typeof name === 'string' && name === 'AbortError';
}

function eventSignature(event: StoredExternalEvent): string {
  return [
    event.externalUid ?? '',
    event.startDate.toISOString(),
    event.endDate.toISOString(),
    event.summary ?? '',
    event.description ?? '',
    normalizeEventStatus(event.status),
  ].join('|');
}

function areStringListsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;

  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false;
  }

  return true;
}

export class CalendarService {
  private readonly syncThrottleMs = env.ICAL_SYNC_THROTTLE_SECONDS * 1000;
  private readonly syncFetchTimeoutMs = env.ICAL_SYNC_FETCH_TIMEOUT_MS;

  constructor(private readonly prisma: PrismaClient) {}

  private resolveFreshness(lastSyncedAt: Date | null) {
    if (!lastSyncedAt) {
      return {
        isFresh: false,
        staleAfter: null,
      };
    }

    const staleAfter = new Date(lastSyncedAt.getTime() + this.syncThrottleMs);

    return {
      isFresh: staleAfter.getTime() > Date.now(),
      staleAfter,
    };
  }

  private buildSourceSyncOutcome(sync: Pick<CalendarSync, 'id' | 'name' | 'sourceUrl' | 'lastSyncedAt' | 'lastStatus' | 'lastError'>, input: {
    status: SourceSyncOutcomeStatus;
    changed?: boolean;
    importedEvents?: number;
    blockingEvents?: number;
  }): SourceSyncOutcome {
    const freshness = this.resolveFreshness(sync.lastSyncedAt);

    return {
      syncId: sync.id,
      name: sync.name ?? null,
      sourceUrl: sync.sourceUrl ?? null,
      status: input.status,
      changed: input.changed ?? false,
      importedEvents: input.importedEvents ?? 0,
      blockingEvents: input.blockingEvents ?? 0,
      lastSyncedAt: sync.lastSyncedAt ? sync.lastSyncedAt.toISOString() : null,
      lastStatus: sync.lastStatus ?? null,
      lastError: sync.lastError ?? null,
      isFresh: freshness.isFresh,
      staleAfter: freshness.staleAfter ? freshness.staleAfter.toISOString() : null,
    };
  }

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
      'external-booked-days': [],
    });
  }

  private parseReservationEventsFromBookings(listingId: string, bookings: Record<string, unknown>) {
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
        if (!start || !end || end <= start) continue;

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
      const start = normalizeDayValue(period.start);
      const end = normalizeDayValue(period.end);
      if (!start || !end || end <= start) continue;

      events.push({
        id: `booked-${listingId}-${index}`,
        start: new Date(`${start}T00:00:00.000Z`),
        end: new Date(`${end}T00:00:00.000Z`),
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

    const [persistedReservations, importedEvents] = await Promise.all([
      this.prisma.reservation.findMany({
        where: {
          listingId,
        },
        orderBy: {
          startDate: 'asc',
        },
      }),
      this.prisma.calendarEvent.findMany({
        where: {
          listingId,
          source: EXTERNAL_SOURCE,
        },
        orderBy: {
          startDate: 'asc',
        },
      }),
    ]);

    const reservationEvents = persistedReservations.length
      ? persistedReservations
        .filter((reservation) => reservation.endDate > reservation.startDate)
        .map((reservation) => ({
          id: reservation.id,
          start: reservation.startDate,
          end: reservation.endDate,
          summary: `Reservation ${reservation.guestName}`,
          description: reservation.message ?? '',
          status: 'confirmed',
        }))
      : this.parseReservationEventsFromBookings(listingId, bookings);

    const calendar = ical({
      name: `IndieHost ${listingId}`,
      prodId: {
        company: 'IndieHost',
        product: env.ICAL_EXPORT_DEFAULT_PRODID,
      },
      timezone: 'UTC',
    });

    calendar.method(ICalCalendarMethod.PUBLISH);

    // Flux public (collé dans Airbnb, Booking…) : les plages suffisent, jamais le nom ni le message du voyageur.
    for (const event of reservationEvents) {
      calendar.createEvent({
        id: event.id,
        start: event.start,
        end: event.end,
        summary: 'Réservé',
        status: toIcalStatus(event.status),
      });
    }

    for (const event of importedEvents) {
      if (!isBlockingEventStatus(event.status)) continue;

      calendar.createEvent({
        id: event.externalUid ?? event.id,
        start: event.startDate,
        end: event.endDate,
        summary: 'Indisponible',
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

    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      abortController.abort();
    }, this.syncFetchTimeoutMs);

    try {
      const response = await fetch(input.url, {
        method: 'GET',
        headers: {
          Accept: 'text/calendar,text/plain,*/*',
        },
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Unable to fetch iCal source (${response.status}).`);
      }

      const payload = await response.text();
      if (!payload.trim()) {
        throw new Error('Fetched iCal source is empty.');
      }

      return payload;
    } catch (error) {
      if (isAbortError(error)) {
        throw new Error(`Unable to fetch iCal source (timeout after ${this.syncFetchTimeoutMs}ms).`);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async replaceSyncEvents(listingId: string, syncId: string, sourceIcal: string): Promise<ReplaceSyncEventsResult> {
    const parsed = nodeIcal.parseICS(sourceIcal);

    const previousEvents = await this.prisma.calendarEvent.findMany({
      where: {
        listingId,
        calendarSyncId: syncId,
        source: EXTERNAL_SOURCE,
      },
      select: {
        listingId: true,
        calendarSyncId: true,
        externalUid: true,
        source: true,
        startDate: true,
        endDate: true,
        summary: true,
        description: true,
        status: true,
      },
      orderBy: {
        startDate: 'asc',
      },
    });

    const deduped = new Map<string, StoredExternalEvent>();

    for (const value of Object.values(parsed)) {
      if (!value || typeof value !== 'object') continue;
      if ((value as { type?: string }).type !== 'VEVENT') continue;

      const event = value as nodeIcal.VEvent;
      const startDate = safeDate(event.start);
      const rawEndDate = safeDate(event.end);
      if (!startDate || !rawEndDate) continue;

      const endDate = rawEndDate > startDate
        ? rawEndDate
        : new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

      const externalUid = typeof event.uid === 'string' && event.uid.trim() ? event.uid.trim() : null;
      const normalizedSummary = typeof event.summary === 'string' ? event.summary : null;
      const normalizedDescription = typeof event.description === 'string' ? event.description : null;
      const normalizedStatus = normalizeEventStatus(event.status);

      const item: StoredExternalEvent = {
        listingId,
        calendarSyncId: syncId,
        externalUid,
        source: EXTERNAL_SOURCE,
        startDate,
        endDate,
        summary: normalizedSummary,
        description: normalizedDescription,
        status: normalizedStatus,
      };

      const fallbackKey = `${startDate.toISOString()}__${endDate.toISOString()}__${normalizedSummary ?? ''}`;
      const key = externalUid ? `uid:${externalUid}` : `fallback:${fallbackKey}`;

      deduped.set(key, item);
    }

    const nextEvents = Array.from(deduped.values());
    const previousSignatures = previousEvents.map((item) => eventSignature(item)).sort();
    const nextSignatures = nextEvents.map((item) => eventSignature(item)).sort();
    const changed = !areStringListsEqual(previousSignatures, nextSignatures);

    await this.prisma.$transaction(async (tx) => {
      await tx.calendarEvent.deleteMany({
        where: {
          listingId,
          calendarSyncId: syncId,
          source: EXTERNAL_SOURCE,
        },
      });

      if (nextEvents.length) {
        await tx.calendarEvent.createMany({
          data: nextEvents,
        });
      }
    });

    return {
      importedEvents: nextEvents.length,
      blockingEvents: nextEvents.filter((item) => isBlockingEventStatus(item.status)).length,
      changed,
    };
  }

  private async rebuildListingBookedDaysFromCalendarEvents(listingId: string): Promise<boolean> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        bookings: true,
      },
    });

    if (!listing) return false;

    const bookings = asObject(listing.bookings, {
      reservations: [],
      'booked-days': [],
      'external-booked-days': [],
    });

    const currentBookedRanges = uniqueSortedRanges(this.extractBookedRanges(bookings['booked-days']));
    const previousExternalRanges = uniqueSortedRanges(this.extractBookedRanges(bookings['external-booked-days']));

    const [persistedReservations, importedEvents] = await Promise.all([
      this.prisma.reservation.findMany({
        where: {
          listingId,
        },
        select: {
          startDate: true,
          endDate: true,
        },
      }),
      this.prisma.calendarEvent.findMany({
        where: {
          listingId,
          source: EXTERNAL_SOURCE,
        },
        select: {
          startDate: true,
          endDate: true,
          status: true,
        },
      }),
    ]);

    const reservationRanges = persistedReservations.length
      ? uniqueSortedRanges(
        persistedReservations
          .map((reservation) => normalizeDayRange(reservation.startDate, reservation.endDate, true))
          .filter((range): range is DayRange => range !== null),
      )
      : uniqueSortedRanges(this.extractReservationRanges(bookings.reservations));

    const nextExternalRanges = uniqueSortedRanges(
      importedEvents
        .filter((event) => isBlockingEventStatus(event.status))
        .map((event) => normalizeDayRange(event.startDate, event.endDate, true))
        .filter((range): range is DayRange => range !== null),
    );

    const previousExternalKeys = new Set(previousExternalRanges.map((range) => rangeKey(range)));
    const manualRanges = currentBookedRanges.filter((range) => !previousExternalKeys.has(rangeKey(range)));
    const nextBookedRanges = uniqueSortedRanges([
      ...manualRanges,
      ...reservationRanges,
      ...nextExternalRanges,
    ]);

    if (areRangesEqual(currentBookedRanges, nextBookedRanges) && areRangesEqual(previousExternalRanges, nextExternalRanges)) {
      return false;
    }

    const nextBookings = {
      ...bookings,
      'booked-days': nextBookedRanges,
      'external-booked-days': nextExternalRanges,
    };

    await this.prisma.listing.update({
      where: {
        id: listingId,
      },
      data: {
        bookings: toPrismaJson(nextBookings),
      },
    });

    return true;
  }

  private extractBookedRanges(input: unknown): DayRange[] {
    if (!Array.isArray(input)) return [];

    const ranges: DayRange[] = [];

    for (const item of input) {
      if (!item || typeof item !== 'object') continue;
      const range = normalizeDayRange((item as Record<string, unknown>).start, (item as Record<string, unknown>).end);
      if (!range) continue;
      ranges.push(range);
    }

    return ranges;
  }

  private extractReservationRanges(input: unknown): DayRange[] {
    if (!Array.isArray(input)) return [];

    const ranges: DayRange[] = [];

    for (const item of input) {
      if (!item || typeof item !== 'object') continue;
      const range = normalizeDayRange((item as Record<string, unknown>).start, (item as Record<string, unknown>).end);
      if (!range) continue;
      ranges.push(range);
    }

    return ranges;
  }

  private async applySyncPayload(sync: CalendarSync, sourceIcal: string): Promise<SourceSyncOutcome> {
    try {
      const replacement = await this.replaceSyncEvents(sync.listingId, sync.id, sourceIcal);

      const updatedSync = await this.prisma.calendarSync.update({
        where: { id: sync.id },
        data: {
          rawIcs: sourceIcal,
          lastStatus: SYNC_STATUS_OK,
          lastError: null,
          lastSyncedAt: new Date(),
        },
      });

      return this.buildSourceSyncOutcome(updatedSync, {
        status: 'synced',
        changed: replacement.changed,
        importedEvents: replacement.importedEvents,
        blockingEvents: replacement.blockingEvents,
      });
    } catch (error) {
      const message = normalizeErrorMessage(error);
      const updatedSync = await this.prisma.calendarSync.update({
        where: { id: sync.id },
        data: {
          lastStatus: SYNC_STATUS_ERROR,
          lastError: message,
          lastSyncedAt: new Date(),
        },
      });

      return this.buildSourceSyncOutcome(updatedSync, {
        status: 'failed',
      });
    }
  }

  private async syncExistingSource(sync: CalendarSync, options?: { force?: boolean }): Promise<SourceSyncOutcome> {
    if (!sync.sourceUrl) {
      return this.buildSourceSyncOutcome(sync, {
        status: 'skipped',
      });
    }

    const force = Boolean(options?.force);

    if (!force) {
      const freshness = this.resolveFreshness(sync.lastSyncedAt);
      if (freshness.isFresh) {
        return this.buildSourceSyncOutcome(sync, {
          status: 'throttled',
        });
      }

      const claim = await this.prisma.calendarSync.updateMany({
        where: {
          id: sync.id,
          OR: [
            { lastSyncedAt: null },
            { lastSyncedAt: { lt: new Date(Date.now() - this.syncThrottleMs) } },
          ],
        },
        data: {
          lastStatus: SYNC_STATUS_SYNCING,
          lastError: null,
          lastSyncedAt: new Date(),
        },
      });

      if (claim.count === 0) {
        const latest = await this.prisma.calendarSync.findUnique({
          where: {
            id: sync.id,
          },
          select: {
            id: true,
            name: true,
            sourceUrl: true,
            lastSyncedAt: true,
            lastStatus: true,
            lastError: true,
          },
        });

        if (latest) {
          return this.buildSourceSyncOutcome(latest, {
            status: 'throttled',
          });
        }

        return this.buildSourceSyncOutcome(sync, {
          status: 'throttled',
        });
      }
    } else {
      await this.prisma.calendarSync.update({
        where: {
          id: sync.id,
        },
        data: {
          lastStatus: SYNC_STATUS_SYNCING,
          lastError: null,
          lastSyncedAt: new Date(),
        },
      });
    }

    try {
      const sourceIcal = await this.parseIncomingIcal({
        url: sync.sourceUrl,
      });
      return this.applySyncPayload(sync, sourceIcal);
    } catch (error) {
      const message = normalizeErrorMessage(error);
      const updatedSync = await this.prisma.calendarSync.update({
        where: {
          id: sync.id,
        },
        data: {
          lastStatus: SYNC_STATUS_ERROR,
          lastError: message,
          lastSyncedAt: new Date(),
        },
      });

      return this.buildSourceSyncOutcome(updatedSync, {
        status: 'failed',
      });
    }
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
        lastStatus: SYNC_STATUS_SYNCING,
        lastError: null,
        lastSyncedAt: new Date(),
      },
    });

    const outcome = await this.applySyncPayload(sync, sourceIcal);

    if (outcome.status === 'synced') {
      await this.rebuildListingBookedDaysFromCalendarEvents(listingId);
    }

    return outcome;
  }

  async syncCalendarSource(listingId: string, syncId: string, options?: { force?: boolean }) {
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

    const outcome = await this.syncExistingSource(sync, {
      force: options?.force ?? true,
    });

    if (outcome.status === 'synced') {
      await this.rebuildListingBookedDaysFromCalendarEvents(listingId);
    }

    return outcome;
  }

  async syncListingSourcesForPublicView(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: {
        id: listingId,
      },
      select: {
        id: true,
      },
    });

    if (!listing) return null;

    const sources = await this.prisma.calendarSync.findMany({
      where: {
        listingId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (!sources.length) {
      return {
        listingId,
        refreshedAt: new Date().toISOString(),
        hasSources: false,
        availabilityUpdated: false,
        syncedSources: 0,
        throttledSources: 0,
        failedSources: 0,
        skippedSources: 0,
        sources: [] as SourceSyncOutcome[],
      };
    }

    const outcomes: SourceSyncOutcome[] = [];

    for (const source of sources) {
      outcomes.push(await this.syncExistingSource(source, { force: false }));
    }

    const shouldRebuildAvailability = outcomes.some((item) => item.status === 'synced');
    const availabilityUpdated = shouldRebuildAvailability
      ? await this.rebuildListingBookedDaysFromCalendarEvents(listingId)
      : false;

    return {
      listingId,
      refreshedAt: new Date().toISOString(),
      hasSources: sources.length > 0,
      availabilityUpdated,
      syncedSources: outcomes.filter((item) => item.status === 'synced').length,
      throttledSources: outcomes.filter((item) => item.status === 'throttled').length,
      failedSources: outcomes.filter((item) => item.status === 'failed').length,
      skippedSources: outcomes.filter((item) => item.status === 'skipped').length,
      sources: outcomes,
    };
  }

  async listCalendarSyncSources(listingId: string) {
    const sources = await this.prisma.calendarSync.findMany({
      where: {
        listingId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return sources.map((source) => {
      const freshness = this.resolveFreshness(source.lastSyncedAt);
      return {
        ...source,
        isFresh: freshness.isFresh,
        staleAfter: freshness.staleAfter,
      };
    });
  }

}
