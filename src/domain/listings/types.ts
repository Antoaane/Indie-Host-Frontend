// File: src/domain/listings/types.ts

import coreJSON from '@/content/fr/ListingTest_0/core.json'
import bookingsJSON from '@/content/fr/ListingTest_0/bookings.json'
import mediasJSON from '@/content/fr/ListingTest_0/medias.json'
import notesJSON from '@/content/fr/ListingTest_0/notes.json'
import commentsJSON from '@/content/fr/ListingTest_0/comments.json'
import hostJSON from '@/content/fr/ListingTest_0/host.json'

export type RawCoreBase = typeof coreJSON
export type RawCore = RawCoreBase & { lat?: number; lng?: number; zoom?: number }
export type RawBookings = typeof bookingsJSON
export type RawMedias = typeof mediasJSON
export type RawNotes = typeof notesJSON
export type RawComments = typeof commentsJSON
export type RawHost = typeof hostJSON

export type RawListingBundle = {
  core?: Partial<RawCore> | null
  bookings?: Partial<RawBookings> | null
  medias?: Partial<RawMedias> | null
  notes?: Partial<RawNotes> | null
  comments?: Partial<RawComments> | null
  host?: Partial<RawHost> | null
}

export type DraftPatch = {
  core?: Partial<RawCore> | null
  bookings?: Partial<RawBookings> | null
  medias?: Partial<RawMedias> | null
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

export type ListingResourceKey = 'core' | 'medias' | 'bookings' | 'notes' | 'comments' | 'host'
