// File: src/views/Management/utils/managementReservations.ts

import type { UserListingCard } from '@/views/Editor/utils/listingApi'
import type { RawBookings, RawComments } from '@/views/Listing/utils/fetchListingRaw'

export type ReservationGuests = {
  adults: number
  children: number
  infants: number
  pets: number
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
}

type GuestProfile = {
  name: string
  avatar?: string
  message?: string
}

const FALLBACK_GUESTS: GuestProfile[] = [
  { name: 'Chlo\u00e9 Lambert', avatar: 'https://randomuser.me/api/portraits/women/44.jpg' },
  { name: 'Arthur Rousseau', avatar: 'https://randomuser.me/api/portraits/men/32.jpg' },
  { name: 'Louis Girard', avatar: 'https://randomuser.me/api/portraits/men/19.jpg' },
  { name: 'Mila Blanc', avatar: 'https://randomuser.me/api/portraits/women/33.jpg' },
  { name: 'Chlo\u00e9 Goulet', avatar: 'https://randomuser.me/api/portraits/women/27.jpg' },
  { name: 'Magali Jaquet', avatar: 'https://randomuser.me/api/portraits/women/12.jpg' },
]

const FALLBACK_MESSAGES = [
  'Bonjour ! Merci pour votre message. Nous serons deux adultes pour un s\u00e9jour calme et reposant. \u00c0 tr\u00e8s vite.',
  'Hello, merci pour les infos. Nous voyageons en couple, sans animaux, et arriverons en fin d\'apr\u00e8s-midi.',
  'Bonjour, s\u00e9jour pr\u00e9vu pour 3 personnes. Besoin d\'un lit b\u00e9b\u00e9 si possible. Merci !',
  'Bonsoir, nous venons pour un week-end d\u00e9tente. On adore votre logement, h\u00e2te d\'y \u00eatre.',
]

const GUEST_COMPOSITIONS: ReservationGuests[] = [
  { adults: 2, children: 0, infants: 0, pets: 0 },
  { adults: 2, children: 1, infants: 0, pets: 0 },
  { adults: 3, children: 0, infants: 0, pets: 1 },
  { adults: 2, children: 2, infants: 1, pets: 0 },
  { adults: 1, children: 0, infants: 0, pets: 0 },
]

const PAYMENT_METHODS = ['Carte', 'Esp\u00e8ce', 'Virement', 'Apple Pay']

const dayMs = 24 * 60 * 60 * 1000

function toDateMs(iso?: string): number {
  if (!iso) return 0
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return 0
  return Date.UTC(year, month - 1, day)
}

function nightsBetween(start: string, end: string): number {
  const diff = (toDateMs(end) - toDateMs(start)) / dayMs
  if (!Number.isFinite(diff)) return 0
  return Math.max(1, Math.round(diff))
}

function sumFees(bookings?: Partial<RawBookings> | null): number {
  const fees = bookings?.fees ?? []
  return fees.reduce((acc, fee) => acc + (Number(fee.amount ?? 0) || 0), 0)
}

function flattenGuests(comments?: RawComments | null): GuestProfile[] {
  const pages = comments?.comments ?? []
  const flattened: GuestProfile[] = []

  for (const page of pages) {
    if (!Array.isArray(page)) continue
    for (const entry of page) {
      if (!entry) continue
      flattened.push({
        name: entry.name,
        avatar: entry['profile-pic'],
        message: entry.comment,
      })
    }
  }

  return flattened
}

function pickGuest(index: number, guests: GuestProfile[]): GuestProfile {
  if (guests.length) return guests[index % guests.length]
  return FALLBACK_GUESTS[index % FALLBACK_GUESTS.length]
}

function pickMessage(index: number, guest?: GuestProfile): string {
  if (guest?.message) return guest.message
  return FALLBACK_MESSAGES[index % FALLBACK_MESSAGES.length]
}

function pickGuestsComposition(index: number): ReservationGuests {
  return GUEST_COMPOSITIONS[index % GUEST_COMPOSITIONS.length]
}

function pickPaymentMethod(index: number): string {
  return PAYMENT_METHODS[index % PAYMENT_METHODS.length]
}

export function sortReservationsByDate(reservations: Reservation[]): Reservation[] {
  return [...reservations].sort((a, b) => toDateMs(b.end) - toDateMs(a.end))
}

export function buildReservationsForListing({
  listing,
  bookings,
  comments,
}: {
  listing: UserListingCard
  bookings?: Partial<RawBookings> | null
  comments?: RawComments | null
}): Reservation[] {
  const bookedDays = bookings?.['booked-days'] ?? []
  const guestsPool = flattenGuests(comments)
  const pricePerNight = Number(bookings?.price ?? listing.pricePerNight ?? 0) || 0
  const feesTotal = sumFees(bookings)

  const reservations = bookedDays.map((range, index) => {
    const guest = pickGuest(index, guestsPool)
    const nights = nightsBetween(range.start, range.end)
    const total = Math.max(0, Math.round(pricePerNight * nights + feesTotal))
    const deposit = Math.round(total * 0.3)
    const balance = Math.max(0, total - deposit)

    return {
      id: `${listing.listingId}-${range.start}-${range.end}-${index}`,
      listingId: listing.listingId,
      start: range.start,
      end: range.end,
      nights,
      guestName: guest.name || `Voyageur ${index + 1}`,
      guestAvatar: guest.avatar,
      message: pickMessage(index, guest),
      guests: pickGuestsComposition(index),
      payment: {
        total,
        deposit,
        balance,
        status: index % 3 === 0 ? 'pending' : 'paid',
        method: pickPaymentMethod(index),
      },
    }
  })

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
