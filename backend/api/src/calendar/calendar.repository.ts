import { Injectable, NotFoundException } from '@nestjs/common'
import { CalendarDirection, CalendarEventSource, CalendarProvider, type Prisma } from '@prisma/client'

import { PrismaService } from '@/common/prisma/prisma.service'
import type { CreateCalendarSyncDto } from '@/calendar/dto/create-calendar-sync.dto'
import { toDateAtUtcMidnight } from '@/shared/date.utils'
import { toStringOrEmpty } from '@/shared/json.utils'

export type ImportedCalendarEventPayload = {
  uid: string
  startISO: string
  endISO: string
  summary?: string
  description?: string
  payload?: Record<string, unknown>
}

@Injectable()
export class CalendarRepository {
  constructor(private readonly prisma: PrismaService) {}

  async resolveListingByPublicIdOrThrow(listingPublicId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { publicId: listingPublicId },
    })

    if (!listing) {
      throw new NotFoundException(`Listing ${listingPublicId} not found`)
    }

    return listing
  }

  async listCalendarEvents({ listingPublicId, start, end }: { listingPublicId: string; start?: string; end?: string }) {
    const listing = await this.resolveListingByPublicIdOrThrow(listingPublicId)

    const dateRangeWhere: Prisma.CalendarEventWhereInput = {
      ...(start || end
        ? {
            AND: [
              ...(start ? [{ endDate: { gte: toDateAtUtcMidnight(start) } }] : []),
              ...(end ? [{ startDate: { lte: toDateAtUtcMidnight(end) } }] : []),
            ],
          }
        : {}),
    }

    const events = await this.prisma.calendarEvent.findMany({
      where: {
        listingId: listing.id,
        ...dateRangeWhere,
      },
      orderBy: { startDate: 'asc' },
    })

    return events.map((event) => ({
      id: event.id,
      source: event.source.toLowerCase(),
      summary: event.summary,
      description: event.description,
      start: event.startDate.toISOString().slice(0, 10),
      end: event.endDate.toISOString().slice(0, 10),
      externalEventUid: event.externalEventUid,
    }))
  }

  async createCalendarSync(listingPublicId: string, payload: CreateCalendarSyncDto) {
    const listing = await this.resolveListingByPublicIdOrThrow(listingPublicId)

    const sync = await this.prisma.calendarSync.create({
      data: {
        listingId: listing.id,
        provider: mapProvider(payload.provider),
        direction: mapDirection(payload.direction),
        externalUrl: payload.externalUrl,
        isActive: payload.isActive ?? true,
      },
    })

    return {
      syncId: sync.id,
      listingId: listing.publicId,
      provider: sync.provider.toLowerCase(),
      direction: sync.direction.toLowerCase(),
      externalUrl: sync.externalUrl,
      isActive: sync.isActive,
    }
  }

  async listCalendarSyncs(listingPublicId: string) {
    const listing = await this.resolveListingByPublicIdOrThrow(listingPublicId)

    const syncs = await this.prisma.calendarSync.findMany({
      where: {
        listingId: listing.id,
      },
      orderBy: { createdAt: 'desc' },
    })

    return syncs.map((sync) => ({
      syncId: sync.id,
      provider: sync.provider.toLowerCase(),
      direction: sync.direction.toLowerCase(),
      externalUrl: sync.externalUrl,
      isActive: sync.isActive,
      lastSyncedAt: sync.lastSyncedAt?.toISOString() ?? null,
      lastStatus: sync.lastStatus ?? null,
    }))
  }

  async findSyncOrThrow(syncId: string) {
    const sync = await this.prisma.calendarSync.findUnique({
      where: { id: syncId },
      include: {
        listing: true,
      },
    })

    if (!sync) {
      throw new NotFoundException(`Calendar sync ${syncId} not found`)
    }

    return sync
  }

  async replaceImportedEvents(syncId: string, events: ImportedCalendarEventPayload[]) {
    const sync = await this.findSyncOrThrow(syncId)

    await this.prisma.$transaction(async (tx) => {
      await tx.calendarEvent.deleteMany({
        where: {
          calendarSyncId: sync.id,
          source: CalendarEventSource.IMPORTED,
        },
      })

      if (events.length) {
        await tx.calendarEvent.createMany({
          data: events.map((event, index) => ({
            listingId: sync.listingId,
            calendarSyncId: sync.id,
            externalEventUid: toStringOrEmpty(event.uid) || `evt-${sync.id}-${index}`,
            source: CalendarEventSource.IMPORTED,
            summary: toStringOrEmpty(event.summary) || 'Unavailable',
            description: toStringOrEmpty(event.description) || null,
            startDate: toDateAtUtcMidnight(event.startISO),
            endDate: toDateAtUtcMidnight(event.endISO),
            payload: event.payload ?? {},
          })),
        })
      }

      await tx.calendarSync.update({
        where: { id: sync.id },
        data: {
          lastSyncedAt: new Date(),
          lastStatus: `ok:${events.length}`,
        },
      })
    })

    return {
      syncId: sync.id,
      importedCount: events.length,
      listingId: sync.listing.publicId,
    }
  }

  async markSyncFailure(syncId: string, reason: string) {
    await this.prisma.calendarSync.update({
      where: { id: syncId },
      data: {
        lastSyncedAt: new Date(),
        lastStatus: `error:${reason.slice(0, 255)}`,
      },
    })
  }

  async getExportCalendarPayload(listingPublicId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { publicId: listingPublicId },
      include: {
        reservations: true,
        calendarEvents: true,
      },
    })

    if (!listing) {
      throw new NotFoundException(`Listing ${listingPublicId} not found`)
    }

    return {
      listing,
      reservations: listing.reservations,
      events: listing.calendarEvents,
    }
  }
}

function mapProvider(provider?: CreateCalendarSyncDto['provider']): CalendarProvider {
  switch (provider) {
    case 'airbnb':
      return CalendarProvider.AIRBNB
    case 'booking':
      return CalendarProvider.BOOKING
    case 'vrbo':
      return CalendarProvider.VRBO
    case 'manual':
      return CalendarProvider.MANUAL
    default:
      return CalendarProvider.ICAL
  }
}

function mapDirection(direction?: CreateCalendarSyncDto['direction']): CalendarDirection {
  switch (direction) {
    case 'import':
      return CalendarDirection.IMPORT
    case 'export':
      return CalendarDirection.EXPORT
    default:
      return CalendarDirection.BIDIRECTIONAL
  }
}
