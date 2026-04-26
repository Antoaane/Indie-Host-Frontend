// File: src/domain/listings/types.ts

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
export type RawRoomBed = Record<string, unknown> & {
  id?: string
  type?: string
  capacity?: number
  quantity?: number
}
export type RawRoom = Record<string, unknown> & {
  id?: string
  'room-name'?: string
  name?: string
  beds?: RawRoomBed[]
}
export type RawCore = Record<string, unknown> & {
  id?: string
  slug?: string
  status?: string
  pause_message?: string
  title?: string
  type?: string
  description?: string
  city?: string
  country?: string
  region?: string
  guest_capacity?: number
  rooms?: RawRoom[]
  amenities?: RawAmenity[]
  perkSettings?: RawPerkSetting[]
  'reviews-display'?: {
    indiehost?: boolean
    airbnb?: boolean
    booking?: boolean
  }
  precise_address?: string
  latitude?: number
  longitude?: number
  lat?: number
  lng?: number
  zoom?: number
}
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
export type RawReservationConfirmation = {
  guideAccessKey?: string
  guideAccessToken?: string
  guideUrl?: string
  generatedAt?: string
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
  percent?: number | null
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
export type RawFee = Record<string, unknown> & {
  id?: string
  label?: string
  amount?: number
  type?: string
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
    confirmation?: RawReservationConfirmation
  }
  confirmation?: RawReservationConfirmation
  createdAt?: string
  messaging?: RawReservationMessaging
}
export type RawBookings = Record<string, unknown> & {
  price?: number
  fees?: RawFee[]
  'booked-days'?: RawBookedDay[]
  'external-booked-days'?: RawBookedDay[]
  reservations?: RawBookingReservation[]
  pricing?: RawPricingSettings
}
export type RawMediaImage = Record<string, unknown> & {
  src: string
  alt?: string
  position?: number
}
export type RawMediaVideo = Record<string, unknown> & {
  src: string
  type?: string
  poster?: string
}
export type RawMedias = Record<string, unknown> & {
  images?: RawMediaImage[]
  videos?: RawMediaVideo[]
}
export type RawNotes = Record<string, unknown> & {
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
}
export type RawComment = Record<string, unknown> & {
  id?: string
  author?: string
  'profile-pic'?: string
  name?: string
  comment?: string
  note?: number
  'stay-dates'?: {
    start?: string
    end?: string
  }
}
export type RawComments = Record<string, unknown> & {
  comments?: RawComment[][]
}
export type RawHost = Record<string, unknown> & {
  name?: string
  status?: string
  seniority?: number
  'global-note'?: number
  avatar?: string
  email?: string
  phone?: string
  'catalog-link'?: string
}
export type RawArrivalIntro = {
  title: string
  subtitle: string
  tagline: string
}
export type RawArrivalFieldSection = Record<string, string>
export type RawArrivalPractical = {
  savings: RawArrivalFieldSection
  access: RawArrivalFieldSection
  services: RawArrivalFieldSection
  rules: string
  shops: string
}
export type RawArrivalGuide = {
  title: string
  content: string
}
export type RawArrival = Record<string, unknown> & {
  intro: RawArrivalIntro
  practical: RawArrivalPractical
  guide: RawArrivalGuide
}

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
  comments?: Partial<RawComments> | null
}

export type VolatileBundle = Pick<RawListingBundle, 'bookings' | 'notes' | 'comments' | 'host'>

export type ListingAvailabilitySyncSource = {
  syncId: string
  name: string | null
  sourceUrl: string | null
  status: 'synced' | 'throttled' | 'failed' | 'skipped'
  changed: boolean
  importedEvents: number
  blockingEvents: number
  lastSyncedAt: string | null
  lastStatus: string | null
  lastError: string | null
  isFresh: boolean
  staleAfter: string | null
}

export type ListingAvailabilitySyncResult = {
  listingId: string
  refreshedAt: string
  hasSources: boolean
  availabilityUpdated: boolean
  syncedSources: number
  throttledSources: number
  failedSources: number
  skippedSources: number
  sources: ListingAvailabilitySyncSource[]
}

export type UserListingCard = {
  listingId: string
  slug?: string
  subdomainSlug?: string
  publicUrl?: string
  ownerId?: string
  ownerDisplayName?: string
  ownerEmail?: string
  ownerUsername?: string
  ownerAvatarUrl?: string
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
