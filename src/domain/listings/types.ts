// File: src/domain/listings/types.ts

import coreJSON from '@/content/fr/ListingTest_0/core.json'
import bookingsJSON from '@/content/fr/ListingTest_0/bookings.json'
import mediasJSON from '@/content/fr/ListingTest_0/medias.json'
import notesJSON from '@/content/fr/ListingTest_0/notes.json'
import commentsJSON from '@/content/fr/ListingTest_0/comments.json'
import hostJSON from '@/content/fr/ListingTest_0/host.json'
import arrivalJSON from '@/content/fr/ListingTest_0/arrival.json'

type Override<T, U> = Omit<T, keyof U> & U

export type RawCoreBase = typeof coreJSON
export type RawPerkScoring = {
  perkEligible?: boolean
  perkScore?: number
  perkPriority?: number
}
export type RawAmenity = RawPerkScoring & {
  id?: string
  name: string
  description?: string
  category?: string
  relevance?: number
  pinned?: boolean
}
export type RawPerkSetting = RawPerkScoring & {
  id: string
  name: string
  description?: string
  icon: string
  enabled?: boolean
}
export type RawCore = Override<RawCoreBase, {
  amenities?: RawAmenity[]
  perkSettings?: RawPerkSetting[]
  precise_address?: string
  latitude?: number
  longitude?: number
  lat?: number
  lng?: number
  zoom?: number
}>
type RawBookingsBase = typeof bookingsJSON
export type RawBookedDay = {
  start: string
  end: string
}
export type RawReservationGuests = {
  adults: number
  children: number
  infants: number
  pets: number
  pmr?: number
}
export type RawReservationPayment = {
  total: number
  deposit: number
  balance: number
  status: 'paid' | 'pending'
  method: string
}
export type RawReservationMessageState = 'sent' | 'delivered' | 'read'
export type RawReservationMessageAuthor = 'host' | 'guest'
export type RawReservationMessage = {
  id: string
  author: RawReservationMessageAuthor
  body: string
  sentAt: string
  state: RawReservationMessageState
}
export type RawReservationMessaging = {
  conversationId?: string
  messages: RawReservationMessage[]
}
export type RawPricingCancellationPolicy = 'flexible' | 'moderate' | 'strict' | 'custom' | string
export type RawPricingCancellation = RawPerkScoring & {
  policy?: RawPricingCancellationPolicy
  custom?: {
    days?: number | null
    feePercent?: number | null
  }
  perkName?: string
  perkDescription?: string
  perkIcon?: string
}
export type RawPricingWeekend = {
  enabled?: boolean
  price?: number | null
}
export type RawPricingDeposit = {
  type?: string
  amount?: number | null
}
export type RawPricingSettings = Record<string, unknown> & {
  cancellation?: RawPricingCancellation
  weekend?: RawPricingWeekend
  deposit?: RawPricingDeposit
}
export type RawBookingReservation = {
  id: string
  start: string
  end: string
  nights: number
  guestName: string
  guestAvatar?: string
  message: string
  guests: RawReservationGuests
  payment: RawReservationPayment
  contact?: {
    firstName?: string
    lastName?: string
    phone?: string
    email?: string
  }
  createdAt?: string
  messaging?: RawReservationMessaging
}
export type RawBookings = Override<RawBookingsBase, {
  'booked-days': RawBookedDay[]
  reservations?: RawBookingReservation[]
  pricing?: RawPricingSettings
}>
export type RawMedias = typeof mediasJSON
export type RawNotes = typeof notesJSON
export type RawComments = typeof commentsJSON
export type RawHost = typeof hostJSON
export type RawArrival = typeof arrivalJSON

export type RawListingBundle = {
  core?: Partial<RawCore> | null
  bookings?: Partial<RawBookings> | null
  medias?: Partial<RawMedias> | null
  arrival?: Partial<RawArrival> | null
  notes?: Partial<RawNotes> | null
  comments?: Partial<RawComments> | null
  host?: Partial<RawHost> | null
}

export type DraftPatch = {
  core?: Partial<RawCore> | null
  bookings?: Partial<RawBookings> | null
  medias?: Partial<RawMedias> | null
  arrival?: Partial<RawArrival> | null
}

export type VolatileBundle = Pick<RawListingBundle, 'bookings' | 'notes' | 'comments' | 'host'>

export type UserListingCard = {
  listingId: string
  title?: string
  status?: string
  hasPendingChanges?: boolean
  coverSrc?: string
  images?: Array<{
    src: string
    alt?: string
    position?: number
    index?: number
  }>
  guestCapacity?: number
  pricePerNight?: number
  rating?: number
}

export type ListingResourceKey = 'core' | 'medias' | 'bookings' | 'arrival' | 'notes' | 'comments' | 'host'
