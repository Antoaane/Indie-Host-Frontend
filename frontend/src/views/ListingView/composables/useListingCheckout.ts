// File: src/views/ListingView/composables/useListingCheckout.ts

import { computed, reactive, ref, type ComputedRef, type Ref } from 'vue'

import { deriveBookedDaysFromReservations, normalizeBookedDay, normalizeBookedDays, normalizeReservations, toUtcDay } from '@/domain/listings/bookings'
import { resolveWeekendPricing } from '@/domain/listings/pricing'
import {
  computeReservationPricing,
  resolveListingReservationRules,
  validateReservationAgainstRules,
  type ListingPaymentRules,
} from '@/domain/listings/reservationRules'
import { resolveCheckoutPaymentBreakdown } from '@/domain/payments/checkoutPayment'
import { createBookingReservation } from '@/domain/api/bookings'
import type { RawBookingReservation, RawBookings, RawCore, RawListingBundle } from '@/domain/listings/types'

import type { ListingParsed } from '@/views/ListingView/types/listing'
import type { ReservationPayload } from '@/views/ListingView/types/reservation'
import type { CheckoutConfirmationPayload } from '@/views/ListingView/types/checkout'

type FetchEditableListingBundle = (listingId: string) => Promise<RawListingBundle>
type PatchListingDraft = (listingId: string, payload: { bookings: Partial<RawBookings> }) => Promise<unknown>

type UseListingCheckoutOptions = {
  listingsMode: 'api' | 'local-json'
  listingData: ComputedRef<ListingParsed | null>
  listingId: ComputedRef<string | null>
  rawListing: Ref<RawListingBundle | null | undefined>
  fetchEditableListingBundle: FetchEditableListingBundle
  patchListingDraft: PatchListingDraft
}

function sanitizeIdPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
}

function createReservationId(currentListingId: string, start: string, end: string) {
  const base = sanitizeIdPart(currentListingId.trim() || 'listing')
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36)
  return `reservation-${base}-${start}-${end}-${suffix}`
}

function computeLegacyStayPricing({
  range,
  bookings,
  core,
}: {
  range: { start: string; end: string }
  bookings?: Partial<RawBookings> | null
  core?: Partial<RawCore> | null
}) {
  const basePrice = Number(bookings?.price ?? 0) || 0
  const reservationRules = resolveListingReservationRules({
    core,
    bookings,
  })
  const nightlyPricing = computeReservationPricing({
    startISO: range.start,
    endISO: range.end,
    basePrice,
    weekendPricing: resolveWeekendPricing(bookings?.pricing ?? null, basePrice),
    fees: bookings?.fees,
    occupants: {
      adults: Math.max(1, reservationRules.occupancy.adultsMin),
      children: 0,
      babies: 0,
      animals: 0,
      pmr: 0,
    },
    rules: reservationRules,
  })

  return {
    nights: Math.max(1, nightlyPricing.nightly.nights),
    total: nightlyPricing.total,
  }
}

function buildLegacyReservationFromRange(
  currentListingId: string,
  range: { start: string; end: string },
  bookings?: Partial<RawBookings> | null,
  core?: Partial<RawCore> | null,
): RawBookingReservation | null {
  const stayPricing = computeLegacyStayPricing({
    range,
    bookings,
    core,
  })
  const nights = stayPricing.nights
  const total = stayPricing.total
  const deposit = Math.round(total * 0.3)
  const balance = Math.max(0, total - deposit)

  const [reservation] = normalizeReservations([
    {
      id: `legacy-${sanitizeIdPart(currentListingId)}-${range.start}-${range.end}`,
      start: range.start,
      end: range.end,
      nights,
      guestName: 'Voyageur',
      message: '',
      guests: {
        adults: 1,
        children: 0,
        infants: 0,
        pets: 0,
        pmr: 0,
      },
      payment: {
        total,
        deposit,
        balance,
        status: 'pending',
        method: 'Carte',
      },
    },
  ])

  return reservation ?? null
}

function mergeReservationsWithBookedDays(
  currentListingId: string,
  bookings?: Partial<RawBookings> | null,
  core?: Partial<RawCore> | null,
): RawBookingReservation[] {
  const reservations = normalizeReservations(bookings?.reservations)
  const ranges = normalizeBookedDays(bookings?.['booked-days'])
  const knownRanges = new Set(reservations.map((reservation) => `${reservation.start}__${reservation.end}`))
  const merged = [...reservations]

  for (const range of ranges) {
    const key = `${range.start}__${range.end}`
    if (knownRanges.has(key)) continue
    const legacyReservation = buildLegacyReservationFromRange(currentListingId, range, bookings, core)
    if (!legacyReservation) continue
    merged.push(legacyReservation)
    knownRanges.add(key)
  }

  return normalizeReservations(merged)
}

function toNonNegativeInt(value: unknown, fallback = 0) {
  const next = Number(value)
  if (!Number.isFinite(next)) return fallback
  return Math.max(0, Math.trunc(next))
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage.trim()
  }
  return fallback
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const aStartMs = toUtcDay(aStart)
  const aEndMs = toUtcDay(aEnd)
  const bStartMs = toUtcDay(bStart)
  const bEndMs = toUtcDay(bEnd)
  if (aStartMs === null || aEndMs === null || bStartMs === null || bEndMs === null) return false
  return aStartMs < bEndMs && bStartMs < aEndMs
}

function buildReservationFromCheckout(
  currentListingId: string,
  reservationPayload: ReservationPayload,
  confirmationPayload: CheckoutConfirmationPayload,
  paymentRules: ListingPaymentRules,
): RawBookingReservation {
  const normalizedRange = normalizeBookedDay({
    start: reservationPayload.startISO ?? undefined,
    end: reservationPayload.endISO ?? undefined,
  })

  if (!normalizedRange) {
    throw new Error('Invalid checkout range')
  }

  const total = Math.max(0, Math.round(Number(reservationPayload.total) || 0))
  const breakdown = resolveCheckoutPaymentBreakdown({
    totalAmount: total,
    choice: confirmationPayload.paymentChoice,
    arrivalDateISO: normalizedRange.start,
    paymentRules,
  })
  const emittedBreakdown = confirmationPayload.payment.breakdown
  if (
    emittedBreakdown.totalAmount !== breakdown.totalAmount ||
    emittedBreakdown.chargeNowAmount !== breakdown.chargeNowAmount ||
    emittedBreakdown.deferredAmount !== breakdown.deferredAmount
  ) {
    console.warn('[ListingView] payment breakdown mismatch, using server-side-safe computed breakdown', {
      emittedBreakdown,
      computedBreakdown: breakdown,
    })
  }
  const paymentIntentStatus = confirmationPayload.payment.paymentIntentStatus
  const immediateChargeSettled =
    paymentIntentStatus === 'succeeded' ||
    paymentIntentStatus === 'processing' ||
    paymentIntentStatus === 'requires_capture'

  const payment = {
    total: breakdown.totalAmount,
    deposit: breakdown.chargeNowAmount,
    balance: breakdown.deferredAmount,
    status: breakdown.deferredAmount === 0 && immediateChargeSettled ? 'paid' as const : 'pending' as const,
    method: breakdown.reservationMethodLabel,
    stripe: {
      paymentIntentId: confirmationPayload.payment.paymentIntentId,
      status: paymentIntentStatus,
      currency: confirmationPayload.payment.currency,
      connectedAccountId: confirmationPayload.payment.connectedAccountId,
      paymentChoice: breakdown.choice,
      chargeNowAmount: breakdown.chargeNowAmount,
      deferredAmount: breakdown.deferredAmount,
      deferredMode: breakdown.deferredMode,
      deferredDueDateISO: breakdown.deferredDueDateISO,
    },
  }

  const travelerFirstName = confirmationPayload.travelerContact.firstName.trim()
  const travelerLastName = confirmationPayload.travelerContact.lastName.trim()
  const travelerFullName = `${travelerFirstName} ${travelerLastName}`.trim()

  const [reservation] = normalizeReservations([
    {
      id: createReservationId(currentListingId, normalizedRange.start, normalizedRange.end),
      start: normalizedRange.start,
      end: normalizedRange.end,
      nights: Math.max(1, toNonNegativeInt(reservationPayload.nights, 1)),
      guestName: travelerFullName || confirmationPayload.cardholder.fullName || 'Voyageur',
      message: confirmationPayload.travelerMessage.trim(),
      guests: {
        adults: Math.max(1, toNonNegativeInt(reservationPayload.occupants.adults, 1)),
        children: toNonNegativeInt(reservationPayload.occupants.children),
        infants: toNonNegativeInt(reservationPayload.occupants.babies),
        pets: toNonNegativeInt(reservationPayload.occupants.animals),
        pmr: toNonNegativeInt(reservationPayload.occupants.pmr),
      },
      payment,
      contact: {
        firstName: travelerFirstName || confirmationPayload.cardholder.firstName.trim(),
        lastName: travelerLastName || confirmationPayload.cardholder.lastName.trim(),
        phone: confirmationPayload.travelerContact.phone.trim(),
      },
      createdAt: new Date().toISOString(),
    },
  ])

  if (!reservation) {
    throw new Error('Reservation payload normalization failed')
  }

  return reservation
}

export function useListingCheckout(options: UseListingCheckoutOptions) {
  const checkoutPayload = ref<ReservationPayload | null>(null)
  const isCheckout = computed(() => Boolean(checkoutPayload.value))
  const checkoutStatus = reactive({
    isSubmitting: false,
    error: null as string | null,
  })

  function onReserve(payload: ReservationPayload) {
    checkoutStatus.error = null
    const listing = options.listingData.value
    if (!listing) return

    const validation = validateReservationAgainstRules({
      startISO: payload.startISO,
      endISO: payload.endISO,
      occupants: payload.occupants,
      rules: listing.bookings.rules,
    })

    if (!validation.range || validation.errors.length > 0) {
      checkoutStatus.error = validation.errors[0] ?? 'Selection de reservation invalide.'
      return
    }

    const pricing = computeReservationPricing({
      startISO: validation.range.startISO,
      endISO: validation.range.endISO,
      basePrice: listing.bookings.price,
      weekendPricing: listing.bookings.weekend,
      fees: listing.bookings.fees,
      occupants: validation.occupants,
      rules: listing.bookings.rules,
    })

    checkoutPayload.value = {
      startISO: validation.range.startISO,
      endISO: validation.range.endISO,
      nights: validation.range.nights,
      occupants: { ...validation.occupants },
      fees: pricing.fees,
      total: pricing.total,
      pricing: {
        nightlySubtotal: Math.round(pricing.nightly.nightlySubtotal),
        nightlyDiscountTotal: Math.round(pricing.nightly.durationDiscountTotal),
        nightlyDiscountPercent: pricing.nightly.durationDiscountPercent,
        discountThresholdNights: pricing.nightly.appliedDurationDiscountTier?.minNights ?? null,
        nightlyTotal: Math.round(pricing.nightly.nightlyTotal),
        averageNightlyPrice: pricing.nightly.averageNightlyPrice,
        feesTotal: pricing.feesTotal,
        extraGuestsTotal: pricing.extraGuestsTotal,
      },
    }
  }

  function cancelCheckout() {
    checkoutStatus.error = null
    checkoutPayload.value = null
  }

  async function confirmCheckout(payload: CheckoutConfirmationPayload) {
    const targetListingId = options.listingId.value
    const reservationPayload = checkoutPayload.value
    checkoutStatus.error = null

    if (!targetListingId) {
      checkoutStatus.error = 'Impossible de déterminer l annonce à réserver.'
      return
    }

    if (!reservationPayload?.startISO || !reservationPayload.endISO) {
      checkoutStatus.error = 'Sélection de dates invalide.'
      return
    }

    checkoutStatus.isSubmitting = true

    try {
      const editable = await options.fetchEditableListingBundle(targetListingId)
      const currentCore = (editable.core ?? options.rawListing.value?.core ?? null) as Partial<RawCore> | null
      const currentBookings = (editable.bookings ?? null) as Partial<RawBookings> | null
      const reservationRules = resolveListingReservationRules({
        core: currentCore,
        bookings: currentBookings,
      })
      const reservationValidation = validateReservationAgainstRules({
        startISO: reservationPayload.startISO,
        endISO: reservationPayload.endISO,
        occupants: reservationPayload.occupants,
        rules: reservationRules,
      })

      if (!reservationValidation.range || reservationValidation.errors.length > 0) {
        checkoutStatus.error = reservationValidation.errors[0] ?? 'Reservation invalide.'
        return
      }

      const reservationPricing = computeReservationPricing({
        startISO: reservationValidation.range.startISO,
        endISO: reservationValidation.range.endISO,
        basePrice: currentBookings?.price ?? 0,
        weekendPricing: resolveWeekendPricing(currentBookings?.pricing ?? null, Number(currentBookings?.price ?? 0) || 0),
        fees: currentBookings?.fees ?? [],
        occupants: reservationValidation.occupants,
        rules: reservationRules,
      })
      const normalizedReservationPayload: ReservationPayload = {
        startISO: reservationValidation.range.startISO,
        endISO: reservationValidation.range.endISO,
        nights: reservationValidation.range.nights,
        occupants: { ...reservationValidation.occupants },
        fees: reservationPricing.fees,
        total: reservationPricing.total,
        pricing: {
          nightlySubtotal: Math.round(reservationPricing.nightly.nightlySubtotal),
          nightlyDiscountTotal: Math.round(reservationPricing.nightly.durationDiscountTotal),
          nightlyDiscountPercent: reservationPricing.nightly.durationDiscountPercent,
          discountThresholdNights: reservationPricing.nightly.appliedDurationDiscountTier?.minNights ?? null,
          nightlyTotal: Math.round(reservationPricing.nightly.nightlyTotal),
          averageNightlyPrice: reservationPricing.nightly.averageNightlyPrice,
          feesTotal: reservationPricing.feesTotal,
          extraGuestsTotal: reservationPricing.extraGuestsTotal,
        },
      }
      const currentReservations = mergeReservationsWithBookedDays(targetListingId, currentBookings, currentCore)
      const createdReservation = buildReservationFromCheckout(
        targetListingId,
        normalizedReservationPayload,
        payload,
        reservationRules.payment,
      )

      const isRangeAlreadyBooked = currentReservations.some((reservation) =>
        rangesOverlap(createdReservation.start, createdReservation.end, reservation.start, reservation.end))

      if (isRangeAlreadyBooked) {
        checkoutStatus.error = 'Cette période vient d être réservée.'
        return
      }

      if (options.listingsMode === 'api') {
        await createBookingReservation({
          listingId: targetListingId,
          reservation: createdReservation,
        })
      } else {
        const nextReservations = normalizeReservations([
          ...currentReservations,
          createdReservation,
        ])
        const nextBookedDays = deriveBookedDaysFromReservations(nextReservations)

        await options.patchListingDraft(targetListingId, {
          bookings: {
            ...(currentBookings ?? {}),
            reservations: nextReservations,
            'booked-days': nextBookedDays,
          },
        })
      }

      cancelCheckout()
    } catch (error) {
      console.error('[ListingView] checkout reservation failed', error)
      checkoutStatus.error = resolveErrorMessage(error, 'Impossible de valider la réservation.')
    } finally {
      checkoutStatus.isSubmitting = false
    }
  }

  return {
    checkoutPayload,
    isCheckout,
    checkoutStatus,
    onReserve,
    cancelCheckout,
    confirmCheckout,
  }
}
