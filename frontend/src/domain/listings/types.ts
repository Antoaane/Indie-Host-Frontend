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
  manual?: {
    entries?: Array<{
      id?: string
      amount: number
      date: string
      method?: string
      comment?: string
    }>
  }
  stripe?: {
    paymentIntentId?: string
    status?: string
    currency?: string
    connectedAccountId?: string
    paymentChoice?: 'full' | 'split' | 'cash'
    chargeNowAmount?: number
    deferredAmount?: number
    deferredMode?: 'none' | 'online' | 'cash'
    deferredDueDateISO?: string | null
  }
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
export type RawPricingStay = {
  minNights?: number | null
  maxNights?: number | null
  weeklyDiscount?: number | null
  monthlyDiscount?: number | null
  durationDiscounts?: RawPricingStayDiscountTier[]
  bookingWindowDiscounts?: RawPricingBookingWindowDiscountTier[]
}
export type RawPricingStayDiscountTier = {
  minNights?: number | null
  percent?: number | null
}
export type RawPricingBookingWindowDiscountTier = {
  maxDaysBeforeArrival?: number | null
  percent?: number | null
}
export type RawPricingExtraGuests = {
  price?: number | null
  threshold?: number | null
}
export type RawPricingTaxesMode = 'per-person-night' | 'per-night'
export type RawPricingTaxesDisplay = 'included' | 'added'
export type RawPricingTaxes = {
  enabled?: boolean
  mode?: RawPricingTaxesMode
  amount?: number | null
  display?: RawPricingTaxesDisplay
}
export type RawPricingPaymentMode = 'full' | 'deposit'
export type RawPricingPaymentBalanceType = 'arrival' | 'before'
export type RawPricingPaymentMethods = {
  card?: boolean
  sepa?: boolean
  cash?: boolean
}
export type RawPricingPaymentBalance = {
  type?: RawPricingPaymentBalanceType
  days?: number | null
}
export type RawPricingPayment = {
  methods?: RawPricingPaymentMethods
  mode?: RawPricingPaymentMode
  depositPercent?: number | null
  balance?: RawPricingPaymentBalance
}
export type RawPricingOccupancy = {
  adultsMin?: number | null
  adultsMax?: number | null
  childrenMax?: number | null
  babiesMax?: number | null
  infantsMax?: number | null
  animalsMax?: number | null
  petsMax?: number | null
  pmrMax?: number | null
  allowChildren?: boolean
  allowBabies?: boolean
  allowAnimals?: boolean
  allowPmr?: boolean
}
export type RawPricingDeposit = {
  type?: string
  amount?: number | null
}
export type RawPricingSettings = Record<string, unknown> & {
  stay?: RawPricingStay
  cancellation?: RawPricingCancellation
  weekend?: RawPricingWeekend
  extraGuests?: RawPricingExtraGuests
  taxes?: RawPricingTaxes
  payment?: RawPricingPayment
  occupancy?: RawPricingOccupancy
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
  internalNote?: string
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
export type RawNotes = Override<typeof notesJSON, {
  note?: {
    note?: number
    distribution?: Record<string, number>
    source?: string
    reviewCount?: number
  }
  'otas-note'?: Array<{
    ota: string
    note?: number
    distribution?: Record<string, number>
    reviewCount?: number
    sourceLabel?: string
  }>
}>
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
  notes?: Partial<RawNotes> | null
}

export type VolatileBundle = Pick<RawListingBundle, 'bookings' | 'notes' | 'comments' | 'host'>

export type UserListingCard = {
  listingId: string
  subdomainSlug?: string
  publicUrl?: string
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
