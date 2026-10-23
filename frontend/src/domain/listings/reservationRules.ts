// File: src/domain/listings/reservationRules.ts

import { nightsBetween, toUtcDay } from '@/domain/listings/bookings'
import { computeNightlyPriceBreakdown, type DurationDiscountTier, type WeekendPricingConfig } from '@/domain/listings/pricing'
import {
  resolveCancellationPolicy,
  type CancellationPolicyCode,
  type ResolvedCancellationPolicy,
} from '@/domain/listings/cancellationPolicy'
import type { RawBookings, RawCore, RawPricingSettings } from '@/domain/listings/types'

export type CheckoutPaymentChoice = 'full' | 'split' | 'cash'
export type OccupantKey = 'adults' | 'children' | 'babies' | 'animals' | 'pmr'
export type OccupantCounts = Record<OccupantKey, number>

export type ListingOccupancyRules = {
  capacity: number
  adultsMin: number
  adultsMax: number
  childrenMax: number
  babiesMax: number
  animalsMax: number
  pmrMax: number
}

export type ListingStayRules = {
  minNights: number
  maxNights: number | null
  discountTiers: ListingStayDiscountTier[]
}

export type ListingStayDiscountTier = DurationDiscountTier

export type ListingExtraGuestRules = {
  enabled: boolean
  price: number
  threshold: number
}

export type ListingPaymentRules = {
  source: 'legacy' | 'pricing'
  methods: {
    card: boolean
    sepa: boolean
    cash: boolean
  }
  onlineEnabled: boolean
  mode: 'full' | 'deposit'
  depositPercent: number
  balance: {
    type: 'arrival' | 'before'
    days: number
  }
  chargeNowRatioByChoice: Record<CheckoutPaymentChoice, number>
  allowedChoices: CheckoutPaymentChoice[]
  blockedReasons: Partial<Record<CheckoutPaymentChoice, string>>
}

// Barème d'annulation : défini une seule fois dans cancellationPolicy.ts (miroir de l'API).
export type ListingCancellationPolicy = CancellationPolicyCode
export type ListingCancellationRules = ResolvedCancellationPolicy

export type ListingReservationRules = {
  occupancy: ListingOccupancyRules
  stay: ListingStayRules
  extraGuests: ListingExtraGuestRules
  payment: ListingPaymentRules
  cancellation: ListingCancellationRules
}

export type ReservationRange = {
  startISO: string
  endISO: string
  nights: number
}

export type NormalizedFeeItem = {
  name: string
  amount: number
}

export type ReservationValidationResult = {
  range: ReservationRange | null
  occupants: OccupantCounts
  travelerCount: number
  errors: string[]
}

export type ReservationPricingBreakdown = {
  range: ReservationRange | null
  occupants: OccupantCounts
  travelerCount: number
  nightly: ReturnType<typeof computeNightlyPriceBreakdown>
  fees: NormalizedFeeItem[]
  feesTotal: number
  extraGuestsCount: number
  extraGuestsPrice: number
  extraGuestsTotal: number
  total: number
}

const DEFAULT_CAPACITY = 1
const MAX_CAPACITY = 50
const DEFAULT_MIN_NIGHTS = 2
const MAX_NIGHTS = 365
const MAX_MONEY = 50000
const DISCOUNT_PERCENT_MIN = 0
const DISCOUNT_PERCENT_MAX = 100
const STAY_DISCOUNT_TIERS_MAX = 24
const PAYMENT_DEPOSIT_PERCENT_MIN = 10
const PAYMENT_DEPOSIT_PERCENT_MAX = 90
const PAYMENT_BALANCE_DAYS_MAX = 365

const DEFAULT_OCCUPANTS: OccupantCounts = {
  adults: 1,
  children: 0,
  babies: 0,
  animals: 0,
  pmr: 0,
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const next = Number(value)
  if (!Number.isFinite(next)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(next)))
}

function toNonNegativeAmount(value: unknown): number {
  const next = Number(value)
  if (!Number.isFinite(next) || next < 0) return 0
  return Math.round(next)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const normalized = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null
  return toUtcDay(normalized) === null ? null : normalized
}

function toPricingSettings(bookings?: Partial<RawBookings> | null): RawPricingSettings {
  if (!isPlainObject(bookings?.pricing)) return {}
  return bookings?.pricing as RawPricingSettings
}

function normalizeDurationDiscountTier(input: unknown): ListingStayDiscountTier | null {
  if (!isPlainObject(input)) return null

  const minNights = clampInteger(
    input.minNights ?? input.threshold ?? input.nights,
    1,
    MAX_NIGHTS,
    1,
  )
  const percent = clampInteger(
    input.percent ?? input.discount ?? input.discountPercent,
    DISCOUNT_PERCENT_MIN,
    DISCOUNT_PERCENT_MAX,
    DISCOUNT_PERCENT_MIN,
  )
  if (percent <= 0) return null

  return {
    minNights,
    percent,
  }
}

function dedupeAndSortDurationDiscountTiers(tiers: ListingStayDiscountTier[]): ListingStayDiscountTier[] {
  const byThreshold = new Map<number, ListingStayDiscountTier>()

  tiers.slice(0, STAY_DISCOUNT_TIERS_MAX).forEach((tier) => {
    const existing = byThreshold.get(tier.minNights)
    if (!existing || tier.percent > existing.percent) {
      byThreshold.set(tier.minNights, tier)
    }
  })

  return Array.from(byThreshold.values()).sort((a, b) => a.minNights - b.minNights)
}

function resolveDurationDiscountTiers(rawStay: Record<string, unknown>): ListingStayDiscountTier[] {
  const configuredTiers = Array.isArray(rawStay.durationDiscounts)
    ? rawStay.durationDiscounts
        .map((entry) => normalizeDurationDiscountTier(entry))
        .filter((entry): entry is ListingStayDiscountTier => Boolean(entry))
    : []

  if (configuredTiers.length > 0) {
    return dedupeAndSortDurationDiscountTiers(configuredTiers)
  }

  const weeklyDiscount = clampInteger(
    rawStay.weeklyDiscount,
    DISCOUNT_PERCENT_MIN,
    DISCOUNT_PERCENT_MAX,
    DISCOUNT_PERCENT_MIN,
  )
  const monthlyDiscount = clampInteger(
    rawStay.monthlyDiscount,
    DISCOUNT_PERCENT_MIN,
    DISCOUNT_PERCENT_MAX,
    DISCOUNT_PERCENT_MIN,
  )

  const legacyTiers: ListingStayDiscountTier[] = []
  if (weeklyDiscount > 0) {
    legacyTiers.push({
      minNights: 7,
      percent: weeklyDiscount,
    })
  }
  if (monthlyDiscount > 0) {
    legacyTiers.push({
      minNights: 28,
      percent: monthlyDiscount,
    })
  }

  return dedupeAndSortDurationDiscountTiers(legacyTiers)
}

function resolveStayRules(pricing: RawPricingSettings): ListingStayRules {
  const rawStay = isPlainObject(pricing.stay) ? pricing.stay : {}
  const minNights = clampInteger(rawStay.minNights, 1, MAX_NIGHTS, DEFAULT_MIN_NIGHTS)
  const maxNights = Number.isFinite(Number(rawStay.maxNights))
    ? clampInteger(rawStay.maxNights, minNights, MAX_NIGHTS, minNights)
    : null
  const discountTiers = resolveDurationDiscountTiers(rawStay)

  return {
    minNights,
    maxNights,
    discountTiers,
  }
}

function resolveOccupancyRules(pricing: RawPricingSettings, capacity: number): ListingOccupancyRules {
  const raw = isPlainObject(pricing.occupancy) ? pricing.occupancy : {}

  const adultsMin = clampInteger(raw.adultsMin, 1, capacity, 1)
  const adultsMax = clampInteger(raw.adultsMax, adultsMin, capacity, capacity)

  const childrenAllowed = raw.allowChildren !== false
  const babiesAllowed = raw.allowBabies !== false
  const animalsAllowed = raw.allowAnimals !== false
  const pmrAllowed = raw.allowPmr !== false

  const childrenMax = childrenAllowed
    ? clampInteger(raw.childrenMax, 0, capacity, capacity)
    : 0
  const babiesMax = babiesAllowed
    ? clampInteger(raw.babiesMax ?? raw.infantsMax, 0, capacity, capacity)
    : 0
  const animalsMax = animalsAllowed
    ? clampInteger(raw.animalsMax ?? raw.petsMax, 0, capacity, capacity)
    : 0
  const pmrMax = pmrAllowed
    ? clampInteger(raw.pmrMax, 0, capacity, capacity)
    : 0

  return {
    capacity,
    adultsMin,
    adultsMax,
    childrenMax,
    babiesMax,
    animalsMax,
    pmrMax,
  }
}

function resolveExtraGuestRules(pricing: RawPricingSettings, capacity: number): ListingExtraGuestRules {
  const raw = isPlainObject(pricing.extraGuests) ? pricing.extraGuests : {}
  const price = clampInteger(raw.price, 0, MAX_MONEY, 0)
  const threshold = Number.isFinite(Number(raw.threshold))
    ? clampInteger(raw.threshold, 0, capacity, capacity)
    : capacity

  return {
    enabled: price > 0 && threshold < capacity,
    price,
    threshold,
  }
}

function resolveLegacyPaymentRules(): ListingPaymentRules {
  return {
    source: 'legacy',
    methods: {
      card: true,
      sepa: true,
      cash: true,
    },
    onlineEnabled: true,
    mode: 'deposit',
    depositPercent: 50,
    balance: {
      type: 'arrival',
      days: 0,
    },
    chargeNowRatioByChoice: {
      full: 1,
      split: 0.5,
      cash: 0.25,
    },
    allowedChoices: [
      'full',
      'split',
      'cash',
    ],
    blockedReasons: {},
  }
}

function resolvePricingPaymentRules(pricing: RawPricingSettings): ListingPaymentRules {
  if (!isPlainObject(pricing.payment)) {
    return resolveLegacyPaymentRules()
  }

  const rawPayment = pricing.payment
  const rawMethods = isPlainObject(rawPayment.methods) ? rawPayment.methods : {}
  const rawBalance = isPlainObject(rawPayment.balance) ? rawPayment.balance : {}

  const methods = {
    card: rawMethods.card === undefined ? true : Boolean(rawMethods.card),
    sepa: Boolean(rawMethods.sepa),
    cash: Boolean(rawMethods.cash),
  }
  const onlineEnabled = methods.card || methods.sepa
  const mode = rawPayment.mode === 'deposit' ? 'deposit' : 'full'
  const depositPercent = clampInteger(
    rawPayment.depositPercent,
    PAYMENT_DEPOSIT_PERCENT_MIN,
    PAYMENT_DEPOSIT_PERCENT_MAX,
    PAYMENT_DEPOSIT_PERCENT_MIN,
  )
  const balanceType = rawBalance.type === 'before' ? 'before' : 'arrival'
  const balanceDays = Number.isFinite(Number(rawBalance.days))
    ? clampInteger(rawBalance.days, 0, PAYMENT_BALANCE_DAYS_MAX, 0)
    : 0

  const blockedReasons: Partial<Record<CheckoutPaymentChoice, string>> = {}
  const allowedChoices: CheckoutPaymentChoice[] = []

  if (mode === 'full') {
    if (onlineEnabled) {
      allowedChoices.push('full')
    } else {
      blockedReasons.full = 'Aucun paiement en ligne n’est autorisé par l’hôte.'
    }

    blockedReasons.split = 'Cet hôte exige un paiement intégral à la réservation.'
    blockedReasons.cash = methods.cash
      ? 'Le paiement différé en espèces n’est pas autorisé pour cette annonce.'
      : 'Le paiement en espèces n’est pas autorisé par l’hôte.'
  } else {
    blockedReasons.full = 'Cet hôte exige un acompte puis un solde.'

    if (onlineEnabled) {
      allowedChoices.push('split')
    } else {
      blockedReasons.split = 'Aucun paiement en ligne n’est autorisé par l’hôte.'
    }

    if (!methods.cash) {
      blockedReasons.cash = 'Le paiement en espèces n’est pas autorisé par l’hôte.'
    } else if (!onlineEnabled) {
      blockedReasons.cash = 'Impossible de collecter l’acompte en ligne pour cette annonce.'
    } else if (balanceType !== 'arrival') {
      blockedReasons.cash = 'Le solde est exigé avant l’arrivée, pas en espèces le jour d’arrivée.'
    } else {
      allowedChoices.push('cash')
    }
  }

  return {
    source: 'pricing',
    methods,
    onlineEnabled,
    mode,
    depositPercent,
    balance: {
      type: balanceType,
      days: balanceDays,
    },
    chargeNowRatioByChoice: {
      full: 1,
      split: mode === 'deposit' ? depositPercent / 100 : 1,
      cash: mode === 'deposit' ? depositPercent / 100 : 1,
    },
    allowedChoices,
    blockedReasons,
  }
}

export function resolveListingReservationRules({
  core,
  bookings,
}: {
  core?: Partial<RawCore> | null
  bookings?: Partial<RawBookings> | null
}): ListingReservationRules {
  const capacity = clampInteger(core?.guest_capacity, DEFAULT_CAPACITY, MAX_CAPACITY, DEFAULT_CAPACITY)
  const pricing = toPricingSettings(bookings)

  return {
    occupancy: resolveOccupancyRules(pricing, capacity),
    stay: resolveStayRules(pricing),
    extraGuests: resolveExtraGuestRules(pricing, capacity),
    payment: resolvePricingPaymentRules(pricing),
    cancellation: resolveCancellationRules(pricing),
  }
}

function resolveCancellationRules(pricing: RawPricingSettings): ListingCancellationRules {
  // Même résolution que l'API : ce qui est annoncé avant le paiement est ce qui sera appliqué.
  return resolveCancellationPolicy(pricing.cancellation)
}

export function normalizeOccupantCounts(input: Partial<OccupantCounts> | null | undefined): OccupantCounts {
  return {
    adults: Math.max(1, clampInteger(input?.adults, 0, MAX_CAPACITY, DEFAULT_OCCUPANTS.adults)),
    children: clampInteger(input?.children, 0, MAX_CAPACITY, DEFAULT_OCCUPANTS.children),
    babies: clampInteger(input?.babies, 0, MAX_CAPACITY, DEFAULT_OCCUPANTS.babies),
    animals: clampInteger(input?.animals, 0, MAX_CAPACITY, DEFAULT_OCCUPANTS.animals),
    pmr: clampInteger(input?.pmr, 0, MAX_CAPACITY, DEFAULT_OCCUPANTS.pmr),
  }
}

export function countTravelers(occupants: OccupantCounts): number {
  return occupants.adults + occupants.children
}

export function clampOccupantsToRules(input: Partial<OccupantCounts> | null | undefined, rules: ListingOccupancyRules): OccupantCounts {
  const normalized = normalizeOccupantCounts(input)

  let adults = clampInteger(normalized.adults, rules.adultsMin, rules.adultsMax, rules.adultsMin)
  let children = clampInteger(normalized.children, 0, rules.childrenMax, 0)

  if (adults + children > rules.capacity) {
    let overflow = adults + children - rules.capacity
    const removableChildren = Math.min(children, overflow)
    children -= removableChildren
    overflow -= removableChildren

    if (overflow > 0) {
      adults = Math.max(rules.adultsMin, adults - overflow)
    }
  }

  const travelers = adults + children
  if (travelers > rules.capacity) {
    adults = Math.min(rules.adultsMax, rules.capacity)
    children = Math.max(0, Math.min(children, rules.capacity - adults))
  }

  return {
    adults,
    children,
    babies: clampInteger(normalized.babies, 0, rules.babiesMax, 0),
    animals: clampInteger(normalized.animals, 0, rules.animalsMax, 0),
    pmr: clampInteger(normalized.pmr, 0, rules.pmrMax, 0),
  }
}

export function getOccupantValidationErrors(
  occupants: Partial<OccupantCounts> | null | undefined,
  rules: ListingOccupancyRules,
): string[] {
  const normalized = normalizeOccupantCounts(occupants)
  const errors: string[] = []

  if (normalized.adults < rules.adultsMin) {
    errors.push(`Au moins ${rules.adultsMin} adulte${rules.adultsMin > 1 ? 's' : ''} est requis.`)
  }
  if (normalized.adults > rules.adultsMax) {
    errors.push(`Maximum ${rules.adultsMax} adulte${rules.adultsMax > 1 ? 's' : ''}.`)
  }
  if (normalized.children > rules.childrenMax) {
    errors.push(`Maximum ${rules.childrenMax} enfant${rules.childrenMax > 1 ? 's' : ''}.`)
  }
  if (normalized.babies > rules.babiesMax) {
    errors.push(`Maximum ${rules.babiesMax} bebe${rules.babiesMax > 1 ? 's' : ''}.`)
  }
  if (normalized.animals > rules.animalsMax) {
    errors.push(`Maximum ${rules.animalsMax} animal${rules.animalsMax > 1 ? 's' : ''} de compagnie.`)
  }
  if (normalized.pmr > rules.pmrMax) {
    errors.push(`Maximum ${rules.pmrMax} personne${rules.pmrMax > 1 ? 's' : ''} PMR.`)
  }

  const travelers = countTravelers(normalized)
  if (travelers > rules.capacity) {
    errors.push(`Capacité maximale : ${rules.capacity} voyageur${rules.capacity > 1 ? 's' : ''} (adultes + enfants).`)
  }

  return errors
}

export function getStayValidationErrors(nights: number, rules: ListingStayRules): string[] {
  const errors: string[] = []
  if (!Number.isFinite(nights) || nights <= 0) {
    errors.push('Selection de dates invalide.')
    return errors
  }

  if (nights < rules.minNights) {
    errors.push(`Séjour minimum : ${rules.minNights} nuit${rules.minNights > 1 ? 's' : ''}.`)
  }
  if (rules.maxNights !== null && nights > rules.maxNights) {
    errors.push(`Séjour maximum : ${rules.maxNights} nuit${rules.maxNights > 1 ? 's' : ''}.`)
  }

  return errors
}

export function resolveReservationRange(startISO: unknown, endISO: unknown): ReservationRange | null {
  const normalizedStart = normalizeIsoDate(startISO)
  const normalizedEnd = normalizeIsoDate(endISO)
  if (!normalizedStart || !normalizedEnd) return null

  const nights = nightsBetween(normalizedStart, normalizedEnd)
  if (nights <= 0) return null

  return {
    startISO: normalizedStart,
    endISO: normalizedEnd,
    nights,
  }
}

export function validateReservationAgainstRules({
  startISO,
  endISO,
  occupants,
  rules,
}: {
  startISO: unknown
  endISO: unknown
  occupants: Partial<OccupantCounts> | null | undefined
  rules: ListingReservationRules
}): ReservationValidationResult {
  const range = resolveReservationRange(startISO, endISO)
  const clampedOccupants = clampOccupantsToRules(occupants, rules.occupancy)
  const travelerCount = countTravelers(clampedOccupants)
  const errors: string[] = []

  if (!range) {
    errors.push('Selection de dates invalide.')
  } else {
    errors.push(...getStayValidationErrors(range.nights, rules.stay))
  }

  errors.push(...getOccupantValidationErrors(clampedOccupants, rules.occupancy))

  return {
    range,
    occupants: clampedOccupants,
    travelerCount,
    errors: Array.from(new Set(errors)),
  }
}

export function normalizeFeeItems(input: unknown): NormalizedFeeItem[] {
  if (!Array.isArray(input)) return []

  return input.map((item, index) => {
    const raw = isPlainObject(item) ? item : {}
    const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : `Frais ${index + 1}`
    const amount = toNonNegativeAmount(raw.amount)

    return {
      name,
      amount,
    }
  })
}

export function computeReservationPricing({
  startISO,
  endISO,
  basePrice,
  weekendPricing,
  fees,
  occupants,
  rules,
}: {
  startISO: string | null
  endISO: string | null
  basePrice: number
  weekendPricing?: WeekendPricingConfig | null
  fees?: unknown
  occupants: Partial<OccupantCounts> | null | undefined
  rules: ListingReservationRules
}): ReservationPricingBreakdown {
  const range = resolveReservationRange(startISO, endISO)
  const normalizedOccupants = clampOccupantsToRules(occupants, rules.occupancy)
  const travelerCount = countTravelers(normalizedOccupants)

  const nightly = computeNightlyPriceBreakdown({
    startISO: range?.startISO ?? '',
    endISO: range?.endISO ?? '',
    basePrice: toNonNegativeAmount(basePrice),
    weekendPricing,
    durationDiscountTiers: rules.stay.discountTiers,
  })

  const normalizedFees = normalizeFeeItems(fees)
  const feesTotal = normalizedFees.reduce((acc, fee) => acc + fee.amount, 0)
  const extraGuestsCount = rules.extraGuests.enabled
    ? Math.max(0, travelerCount - rules.extraGuests.threshold)
    : 0
  const extraGuestsTotal = extraGuestsCount * rules.extraGuests.price * nightly.nights
  const total = Math.max(0, Math.round(nightly.nightlyTotal + feesTotal + extraGuestsTotal))

  return {
    range,
    occupants: normalizedOccupants,
    travelerCount,
    nightly,
    fees: normalizedFees,
    feesTotal,
    extraGuestsCount,
    extraGuestsPrice: rules.extraGuests.price,
    extraGuestsTotal,
    total,
  }
}

export function isCheckoutPaymentChoiceAllowed(choice: CheckoutPaymentChoice, rules: ListingPaymentRules): boolean {
  return rules.allowedChoices.includes(choice)
}

export function resolveCheckoutPaymentChoice(choice: CheckoutPaymentChoice, rules: ListingPaymentRules): CheckoutPaymentChoice | null {
  if (isCheckoutPaymentChoiceAllowed(choice, rules)) return choice
  return rules.allowedChoices[0] ?? null
}
