// File: src/domain/listings/bookings.ts

import type { RawBookedDay, RawBookingReservation, RawBookings, RawReservationMessage, RawReservationMessageAuthor, RawReservationMessaging, RawReservationMessageState, RawReservationGuests, RawReservationPayment } from '@/domain/listings/types'

const DAY_MS = 24 * 60 * 60 * 1000

function toInt(value: unknown, fallback: number) {
  const next = Number(value)
  if (!Number.isFinite(next)) return fallback
  return Math.trunc(next)
}

function toNonNegativeInt(value: unknown, fallback = 0) {
  return Math.max(0, toInt(value, fallback))
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function toIsoDateTime(value: unknown): string | null {
  if (!isNonEmptyString(value)) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function toUtcDay(iso?: string): number | null {
  if (!isNonEmptyString(iso)) return null
  const [
    year,
    month,
    day,
  ] = iso.split('-').map(Number)
  if (!year || !month || !day) return null
  return Date.UTC(year, month - 1, day)
}

export function nightsBetween(start: string, end: string): number {
  const startUtc = toUtcDay(start)
  const endUtc = toUtcDay(end)
  if (startUtc === null || endUtc === null || endUtc <= startUtc) return 0
  return Math.round((endUtc - startUtc) / DAY_MS)
}

export function normalizeBookedDay(input: Partial<RawBookedDay> | null | undefined): RawBookedDay | null {
  const start = isNonEmptyString(input?.start) ? input.start.trim() : ''
  const end = isNonEmptyString(input?.end) ? input.end.trim() : ''
  if (!start || !end) return null

  const startUtc = toUtcDay(start)
  const endUtc = toUtcDay(end)
  if (startUtc === null || endUtc === null || endUtc <= startUtc) return null

  return { start, end }
}

export function normalizeBookedDays(input: unknown): RawBookedDay[] {
  if (!Array.isArray(input)) return []

  const deduped = new Map<string, RawBookedDay>()

  for (const item of input) {
    const normalized = normalizeBookedDay(item as Partial<RawBookedDay>)
    if (!normalized) continue
    deduped.set(`${normalized.start}__${normalized.end}`, normalized)
  }

  return Array.from(deduped.values()).sort((a, b) => {
    const aStart = toUtcDay(a.start) ?? 0
    const bStart = toUtcDay(b.start) ?? 0
    if (aStart !== bStart) return aStart - bStart
    const aEnd = toUtcDay(a.end) ?? 0
    const bEnd = toUtcDay(b.end) ?? 0
    return aEnd - bEnd
  })
}

function normalizeGuests(input: Partial<RawReservationGuests> | null | undefined): RawReservationGuests {
  return {
    adults: Math.max(1, toNonNegativeInt(input?.adults, 1)),
    children: toNonNegativeInt(input?.children),
    infants: toNonNegativeInt(input?.infants),
    pets: toNonNegativeInt(input?.pets),
    pmr: toNonNegativeInt(input?.pmr),
  }
}

function normalizePayment(input: Partial<RawReservationPayment> | null | undefined, fallbackTotal: number): RawReservationPayment {
  const total = Math.max(0, Number.isFinite(Number(input?.total)) ? Number(input?.total) : fallbackTotal)
  const fallbackDeposit = Math.round(total * 0.3)
  const rawDeposit = Number.isFinite(Number(input?.deposit)) ? Number(input?.deposit) : fallbackDeposit
  const deposit = Math.max(0, Math.min(total, rawDeposit))
  const rawBalance = Number.isFinite(Number(input?.balance)) ? Number(input?.balance) : total - deposit
  const balance = Math.max(0, rawBalance)
  const status = input?.status === 'paid' ? 'paid' : 'pending'
  const method = isNonEmptyString(input?.method) ? input.method.trim() : 'Carte'

  return {
    total: Math.round(total),
    deposit: Math.round(deposit),
    balance: Math.round(balance),
    status,
    method,
  }
}

function normalizeMessageAuthor(value: unknown): RawReservationMessageAuthor {
  return value === 'guest' ? 'guest' : 'host'
}

function normalizeMessageState(value: unknown): RawReservationMessageState {
  if (value === 'read') return 'read'
  if (value === 'delivered') return 'delivered'
  return 'sent'
}

function normalizeMessage(input: Partial<RawReservationMessage> | null | undefined, index: number, fallbackSentAt?: string): RawReservationMessage | null {
  if (!input || typeof input !== 'object') return null
  const body = isNonEmptyString(input.body) ? input.body.trim() : ''
  if (!body) return null

  const sentAt = toIsoDateTime(input.sentAt) ?? toIsoDateTime(fallbackSentAt) ?? null
  if (!sentAt) return null

  const id = isNonEmptyString(input.id) ? input.id.trim() : `message-${index + 1}-${sentAt}`

  return {
    id,
    author: normalizeMessageAuthor(input.author),
    body,
    sentAt,
    state: normalizeMessageState(input.state),
  }
}

function normalizeMessaging(input: Partial<RawReservationMessaging> | null | undefined, createdAt?: string): RawReservationMessaging | undefined {
  if (!input || typeof input !== 'object') return undefined
  const fallbackSentAt = toIsoDateTime(createdAt) ?? undefined
  const rawMessages = Array.isArray(input.messages) ? input.messages : []
  const messages = rawMessages
    .map((item, index) => normalizeMessage(item as Partial<RawReservationMessage>, index, fallbackSentAt))
    .filter((item): item is RawReservationMessage => item !== null)
    .sort((a, b) => {
      const aMs = Date.parse(a.sentAt)
      const bMs = Date.parse(b.sentAt)
      return aMs - bMs
    })

  const conversationId = isNonEmptyString(input.conversationId) ? input.conversationId.trim() : undefined

  if (!messages.length && !conversationId) return undefined

  return {
    ...(conversationId ? { conversationId } : {}),
    messages,
  }
}

export function normalizeReservation(input: Partial<RawBookingReservation> | null | undefined, index = 0): RawBookingReservation | null {
  if (!input || typeof input !== 'object') return null

  const range = normalizeBookedDay({
    start: input.start,
    end: input.end,
  })

  if (!range) return null

  const fallbackNights = nightsBetween(range.start, range.end)
  const nights = Math.max(1, toNonNegativeInt(input.nights, fallbackNights || 1))
  const guestName = isNonEmptyString(input.guestName) ? input.guestName.trim() : `Voyageur ${index + 1}`
  const guestAvatar = isNonEmptyString(input.guestAvatar) ? input.guestAvatar.trim() : undefined
  const message = isNonEmptyString(input.message) ? input.message.trim() : ''
  const guests = normalizeGuests(input.guests)
  const payment = normalizePayment(input.payment, 0)
  const id = isNonEmptyString(input.id) ? input.id.trim() : `reservation-${range.start}-${range.end}-${index + 1}`
  const createdAt = isNonEmptyString(input.createdAt) ? input.createdAt.trim() : undefined
  const messaging = normalizeMessaging(input.messaging, createdAt)

  const contact =
    input.contact && typeof input.contact === 'object'
      ? {
          firstName: isNonEmptyString(input.contact.firstName) ? input.contact.firstName.trim() : undefined,
          lastName: isNonEmptyString(input.contact.lastName) ? input.contact.lastName.trim() : undefined,
          phone: isNonEmptyString(input.contact.phone) ? input.contact.phone.trim() : undefined,
          email: isNonEmptyString(input.contact.email) ? input.contact.email.trim() : undefined,
        }
      : undefined

  return {
    id,
    start: range.start,
    end: range.end,
    nights,
    guestName,
    guestAvatar,
    message,
    guests,
    payment,
    ...(contact ? { contact } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(messaging ? { messaging } : {}),
  }
}

export function normalizeReservations(input: unknown): RawBookingReservation[] {
  if (!Array.isArray(input)) return []

  const deduped = new Map<string, RawBookingReservation>()

  input.forEach((item, index) => {
    const normalized = normalizeReservation(item as Partial<RawBookingReservation>, index)
    if (!normalized) return
    deduped.set(normalized.id, normalized)
  })

  return Array.from(deduped.values()).sort((a, b) => {
    const aEnd = toUtcDay(a.end) ?? 0
    const bEnd = toUtcDay(b.end) ?? 0
    if (aEnd !== bEnd) return bEnd - aEnd
    const aStart = toUtcDay(a.start) ?? 0
    const bStart = toUtcDay(b.start) ?? 0
    return bStart - aStart
  })
}

export function deriveBookedDaysFromReservations(reservations: RawBookingReservation[]): RawBookedDay[] {
  return normalizeBookedDays(
    reservations.map((reservation) => ({
      start: reservation.start,
      end: reservation.end,
    })),
  )
}

export function getSynchronizedBookedDays(bookings?: Partial<RawBookings> | null): RawBookedDay[] {
  const normalizedReservations = normalizeReservations(bookings?.reservations)
  const fromBookedDays = normalizeBookedDays(bookings?.['booked-days'])
  if (!normalizedReservations.length) return fromBookedDays
  const fromReservations = deriveBookedDaysFromReservations(normalizedReservations)
  return normalizeBookedDays([
    ...fromReservations,
    ...fromBookedDays,
  ])
}
