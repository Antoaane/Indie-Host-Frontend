import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import ical from 'ical-generator'
import * as nodeIcal from 'node-ical'

import { CalendarRepository, type ImportedCalendarEventPayload } from '@/calendar/calendar.repository'
import type { CreateCalendarSyncDto } from '@/calendar/dto/create-calendar-sync.dto'
import type { ListCalendarEventsQueryDto } from '@/calendar/dto/list-calendar-events-query.dto'
import { toDateAtUtcMidnight, toDateAtUtcNoon } from '@/shared/date.utils'
import { toStringOrEmpty } from '@/shared/json.utils'

@Injectable()
export class CalendarService {
  constructor(
    private readonly calendarRepository: CalendarRepository,
    private readonly configService: ConfigService,
  ) {}

  async listEvents(listingId: string, query: ListCalendarEventsQueryDto) {
    return this.calendarRepository.listCalendarEvents({
      listingPublicId: listingId,
      start: query.start,
      end: query.end,
    })
  }

  async createSync(listingId: string, payload: CreateCalendarSyncDto) {
    return this.calendarRepository.createCalendarSync(listingId, payload)
  }

  async listSyncs(listingId: string) {
    return this.calendarRepository.listCalendarSyncs(listingId)
  }

  async pullSync(syncId: string) {
    const sync = await this.calendarRepository.findSyncOrThrow(syncId)

    try {
      const syncUrl = normalizeIcalUrl(sync.externalUrl)
      const response = await fetch(syncUrl)
      if (!response.ok) {
        throw new Error(`Remote calendar request failed with status ${response.status}`)
      }

      const icsContent = await response.text()
      const parsed = await nodeIcal.async.parseICS(icsContent)
      const events: ImportedCalendarEventPayload[] = []

      for (const item of Object.values(parsed)) {
        if (!item || item.type !== 'VEVENT') continue

        const start = item.start instanceof Date ? item.start : null
        const end = item.end instanceof Date ? item.end : null
        if (!start || !end) continue

        events.push({
          uid: toStringOrEmpty(item.uid) || `evt-${start.getTime()}`,
          startISO: start.toISOString().slice(0, 10),
          endISO: end.toISOString().slice(0, 10),
          summary: toStringOrEmpty(item.summary),
          description: toStringOrEmpty(item.description),
          payload: {
            sequence: item.sequence,
            location: toStringOrEmpty(item.location),
            organizer: typeof item.organizer === 'object' ? item.organizer : undefined,
          },
        })
      }

      return this.calendarRepository.replaceImportedEvents(sync.id, events)
    } catch (error) {
      await this.calendarRepository.markSyncFailure(sync.id, (error as Error).message)
      throw error
    }
  }

  async exportIcal(listingId: string) {
    const payload = await this.calendarRepository.getExportCalendarPayload(listingId)
    const prodId = this.configService.get<string>('calendar.prodId') ?? 'IndieHost//Calendar//FR'

    const calendar = ical({
      name: `IndieHost ${payload.listing.publicId}`,
      prodId,
      timezone: 'UTC',
    })

    for (const reservation of payload.reservations) {
      const startISO = reservation.startDate.toISOString().slice(0, 10)
      const endISO = reservation.endDate.toISOString().slice(0, 10)

      calendar.createEvent({
        id: `reservation-${reservation.publicId}`,
        start: toDateAtUtcNoon(startISO),
        end: toDateAtUtcNoon(endISO),
        summary: `Réservation ${reservation.guestName}`,
        description: reservation.guestMessage ?? undefined,
      })
    }

    for (const event of payload.events) {
      if (event.source === 'INTERNAL') continue

      calendar.createEvent({
        id: event.externalEventUid ?? `calendar-event-${event.id}`,
        start: toDateAtUtcMidnight(event.startDate.toISOString().slice(0, 10)),
        end: toDateAtUtcMidnight(event.endDate.toISOString().slice(0, 10)),
        summary: event.summary ?? 'Unavailable',
        description: event.description ?? undefined,
      })
    }

    return calendar.toString()
  }
}

function normalizeIcalUrl(url: string): string {
  const trimmed = url.trim()
  if (trimmed.startsWith('webcal://')) {
    return `https://${trimmed.slice('webcal://'.length)}`
  }
  return trimmed
}
