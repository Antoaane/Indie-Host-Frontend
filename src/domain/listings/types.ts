// File: src/domain/listings/types.ts

import coreJSON from '@/content/fr/ListingTest_0/core.json'
import bookingsJSON from '@/content/fr/ListingTest_0/bookings.json'
import mediasJSON from '@/content/fr/ListingTest_0/medias.json'
import notesJSON from '@/content/fr/ListingTest_0/notes.json'
import commentsJSON from '@/content/fr/ListingTest_0/comments.json'
import hostJSON from '@/content/fr/ListingTest_0/host.json'
import arrivalJSON from '@/content/fr/ListingTest_0/arrival.json'

export type RawCoreBase = typeof coreJSON
export type RawCore = RawCoreBase & { lat?: number; lng?: number; zoom?: number }
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
export type RawBookings = Omit<RawBookingsBase, 'booked-days' | 'reservations'> & {
  'booked-days': RawBookedDay[]
  reservations?: RawBookingReservation[]
}
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
