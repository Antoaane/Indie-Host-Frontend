// File: src/views/Management/utils/managementReservations.ts

import { getSynchronizedBookedDays, normalizeReservations, nightsBetween } from '@/domain/listings/bookings'
import type { RawBookingReservation, RawBookings, UserListingCard } from '@/domain/listings/types'

export type ReservationGuests = {
  adults: number
  children: number
  infants: number
  pets: number
  pmr: number
}

export type ReservationPayment = {
  total: number
  deposit: number
  balance: number
  status: 'paid' | 'pending'
  method: string
}

export type Reservation = {
  id: string
  listingId: string
  start: string
  end: string
  nights: number
  guestName: string
  guestAvatar?: string
  message: string
  guests: ReservationGuests
  payment: ReservationPayment
  contact?: RawBookingReservation['contact']
  createdAt?: string
}

function toDateMs(iso?: string): number {
  if (!iso) return 0
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return 0
  return Date.UTC(year, month - 1, day)
}

function toUtcTodayMs(referenceDate = new Date()) {
  return Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate(),
  )
}

function reservationDistanceToReference(reservation: Reservation, referenceMs: number) {
  const start = toDateMs(reservation.start)
  const end = toDateMs(reservation.end)
  if (!start || !end || end < start) return Number.POSITIVE_INFINITY

  if (referenceMs < start) return start - referenceMs
  if (referenceMs > end) return referenceMs - end
  return 0
}

function compareReservationRelevance(a: Reservation, b: Reservation, referenceMs: number) {
  const distanceA = reservationDistanceToReference(a, referenceMs)
  const distanceB = reservationDistanceToReference(b, referenceMs)
  if (distanceA !== distanceB) return distanceA - distanceB

  const aStart = toDateMs(a.start)
  const aEnd = toDateMs(a.end)
  const bStart = toDateMs(b.start)
  const bEnd = toDateMs(b.end)

  const aFuture = aStart > referenceMs
  const bFuture = bStart > referenceMs
  if (aFuture !== bFuture) return aFuture ? -1 : 1

  if (aEnd !== bEnd) return bEnd - aEnd
  if (aStart !== bStart) return bStart - aStart
  return 0
}

function sumFees(bookings?: Partial<RawBookings> | null): number {
  const fees = bookings?.fees ?? []
  return fees.reduce((acc, fee) => acc + (Number(fee.amount ?? 0) || 0), 0)
}

function toNonNegativeInt(value: unknown, fallback = 0) {
  const next = Number(value)
  if (!Number.isFinite(next)) return fallback
  return Math.max(0, Math.trunc(next))
}

function normalizeGuests(input: Partial<ReservationGuests> | undefined): ReservationGuests {
  return {
    adults: Math.max(1, toNonNegativeInt(input?.adults, 1)),
    children: toNonNegativeInt(input?.children),
    infants: toNonNegativeInt(input?.infants),
    pets: toNonNegativeInt(input?.pets),
    pmr: toNonNegativeInt(input?.pmr),
  }
}

function normalizePayment(
  input: Partial<ReservationPayment> | undefined,
  fallbackTotal: number,
): ReservationPayment {
  const totalCandidate = Number(input?.total)
  const total = Math.max(0, Number.isFinite(totalCandidate) && totalCandidate > 0 ? totalCandidate : fallbackTotal)

  const fallbackDeposit = Math.round(total * 0.3)
  const depositCandidate = Number(input?.deposit)
  const deposit = Math.max(0, Math.min(total, Number.isFinite(depositCandidate) ? depositCandidate : fallbackDeposit))

  const balanceCandidate = Number(input?.balance)
  const fallbackBalance = Math.max(0, total - deposit)
  const balance = Math.max(0, Number.isFinite(balanceCandidate) ? balanceCandidate : fallbackBalance)

  return {
    total: Math.round(total),
    deposit: Math.round(deposit),
    balance: Math.round(balance),
    status: input?.status === 'paid' ? 'paid' : 'pending',
    method: typeof input?.method === 'string' && input.method.trim() ? input.method.trim() : 'Carte',
  }
}

function mapReservation(
  reservation: RawBookingReservation,
  listingId: string,
  pricePerNight: number,
  feesTotal: number,
  fallbackIndex = 0,
): Reservation {
  const safeNights = Math.max(1, toNonNegativeInt(reservation.nights, nightsBetween(reservation.start, reservation.end) || 1))
  const fallbackTotal = Math.max(0, Math.round(pricePerNight * safeNights + feesTotal))

  return {
    id: reservation.id || `${listingId}-${reservation.start}-${reservation.end}-${fallbackIndex}`,
    listingId,
    start: reservation.start,
    end: reservation.end,
    nights: safeNights,
    guestName: reservation.guestName?.trim() || `Voyageur ${fallbackIndex + 1}`,
    guestAvatar: reservation.guestAvatar,
    message: reservation.message ?? '',
    guests: normalizeGuests(reservation.guests),
    payment: normalizePayment(reservation.payment, fallbackTotal),
    contact: reservation.contact,
    createdAt: reservation.createdAt,
  }
}

function buildFallbackReservationsFromBookedDays(
  listingId: string,
  bookings?: Partial<RawBookings> | null,
): Reservation[] {
  const bookedDays = getSynchronizedBookedDays(bookings)
  const pricePerNight = Number(bookings?.price ?? 0) || 0
  const feesTotal = sumFees(bookings)

  return bookedDays.map((range, index) => {
    const nights = Math.max(1, nightsBetween(range.start, range.end))
    const fallbackTotal = Math.max(0, Math.round(pricePerNight * nights + feesTotal))
    return {
      id: `${listingId}-${range.start}-${range.end}-${index}`,
      listingId,
      start: range.start,
      end: range.end,
      nights,
      guestName: `Voyageur ${index + 1}`,
      message: '',
      guests: {
        adults: 1,
        children: 0,
        infants: 0,
        pets: 0,
        pmr: 0,
      },
      payment: normalizePayment(undefined, fallbackTotal),
    }
  })
}

export function sortReservationsByDate(reservations: Reservation[]): Reservation[] {
  return [...reservations].sort((a, b) => toDateMs(b.end) - toDateMs(a.end))
}

export function buildReservationsForListing({
  listing,
  bookings,
}: {
  listing: UserListingCard
  bookings?: Partial<RawBookings> | null
}): Reservation[] {
  const normalized = normalizeReservations(bookings?.reservations)
  const pricePerNight = Number(bookings?.price ?? listing.pricePerNight ?? 0) || 0
  const feesTotal = sumFees(bookings)

  const reservations = normalized.length
    ? normalized.map((reservation, index) =>
      mapReservation(reservation, listing.listingId, pricePerNight, feesTotal, index))
    : buildFallbackReservationsFromBookedDays(listing.listingId, bookings)

  return sortReservationsByDate(reservations)
}

export function findLatestReservation(reservationsByListing: Record<string, Reservation[]>): {
  listingId: string
  reservation: Reservation
} | null {
  let latest: { listingId: string; reservation: Reservation } | null = null

  for (const [listingId, reservations] of Object.entries(reservationsByListing)) {
    for (const reservation of reservations) {
      if (!latest) {
        latest = { listingId, reservation }
        continue
      }

      if (toDateMs(reservation.end) > toDateMs(latest.reservation.end)) {
        latest = { listingId, reservation }
      }
    }
  }

  return latest
}

export function findLatestReservationForListing(reservations: Reservation[]): Reservation | null {
  if (!reservations.length) return null
  const sorted = sortReservationsByDate(reservations)
  return sorted[0] ?? null
}

export function findClosestReservationForListing(
  reservations: Reservation[],
  referenceDate = new Date(),
): Reservation | null {
  if (!reservations.length) return null
  const referenceMs = toUtcTodayMs(referenceDate)

  return reservations.reduce<Reservation | null>((closest, current) => {
    if (!closest) return current
    return compareReservationRelevance(current, closest, referenceMs) < 0 ? current : closest
  }, null)
}

export function findClosestReservation(
  reservationsByListing: Record<string, Reservation[]>,
  referenceDate = new Date(),
): {
  listingId: string
  reservation: Reservation
} | null {
  const referenceMs = toUtcTodayMs(referenceDate)
  let closest: { listingId: string; reservation: Reservation } | null = null

  for (const [listingId, reservations] of Object.entries(reservationsByListing)) {
    for (const reservation of reservations) {
      if (!closest) {
        closest = { listingId, reservation }
        continue
      }

      if (compareReservationRelevance(reservation, closest.reservation, referenceMs) < 0) {
        closest = { listingId, reservation }
      }
    }
  }

  return closest
}
