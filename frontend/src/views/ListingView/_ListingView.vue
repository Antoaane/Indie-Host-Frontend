<!-- File: src/views/ListingView/_ListingView.vue -->

<script setup lang="ts">
// DEPS
import { computed, reactive, ref, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'

// UTILS
import { vp } from '@/utils/viewport'
import { core } from '@/views/ListingView/utils/useParseContent'
import { deriveBookedDaysFromReservations, nightsBetween, normalizeBookedDay, normalizeBookedDays, normalizeReservations, toUtcDay } from '@/domain/listings/bookings'
import { resolveWeekendPricing } from '@/domain/listings/pricing'
import { getListingsController } from '@/domain/listings/controller'
import type { RawBookingReservation, RawBookings, RawCore, RawListingBundle } from '@/domain/listings/types'
import { getListingStatusFlags } from '@/domain/listings/status'
import { resolveCheckoutPaymentBreakdown, type CheckoutPaymentBreakdown, type CheckoutPaymentChoice } from '@/domain/payments/checkoutPayment'
import {
  computeReservationPricing,
  resolveListingReservationRules,
  validateReservationAgainstRules,
  type ListingPaymentRules,
} from '@/domain/listings/reservationRules'
import { getOwnerStripeConnectAccountId } from '@/domain/user/stripeConnect'
import type { RangeISO } from '@/components/DatePicker/helpers/date'

// COMPONENTS
import Gallery from '@/views/ListingView/components/Gallery/Gallery.vue'
import Core from '@/views/ListingView/components/Core/Core.vue'
import Comments from '@/views/ListingView/components/Comments/Comments.vue'
import Booking from '@/views/ListingView/components/Booking/Booking.vue'
import BookingMin from '@/views/ListingView/components/BookingMin/BookingMin.vue'
import Checkout from '@/views/ListingView/components/Checkout/Checkout.vue'

// TYPES
import type { ListingParsed } from '@/views/ListingView/types/listing'
import type { StyleValue } from 'vue'
import type { ReservationPayload } from '@/views/ListingView/types/reservation'

const props = defineProps<{
  rawListing?: RawListingBundle | null
  aspect?: {
    width: number
    height: number
  }
}>()
const route = useRoute()
const controller = getListingsController()

const listingData = computed<ListingParsed | null>(() => {
  if (!props.rawListing) return null
  return core(props.rawListing)
})

const statusFlags = computed(() => getListingStatusFlags(props.rawListing?.core?.status))
const isBookingDisabled = computed(() => !statusFlags.value.isBookable)
const bookingDisabledLabel = computed(() => (statusFlags.value.isBlocked ? 'Réservations bloquées' : 'Indisponible'))
const bookingDisabledHint = computed(() =>
  statusFlags.value.isBlocked
    ? 'Cette annonce reste consultable mais les réservations sont suspendues.'
    : 'Les réservations ne sont pas disponibles pour le moment.',
)

const bookingRange = ref<RangeISO | null>(null)
const checkoutPayload = ref<ReservationPayload | null>(null)
const isCheckout = computed(() => Boolean(checkoutPayload.value))
const checkoutStatus = reactive({
  isSubmitting: false,
  error: null as string | null,
})

const pvWidth = ref<number | undefined>(0)
const pvHeight = ref<number | undefined>(0)

const listingView = ref<HTMLElement | null>(null)
const lvWidth = ref<number | null>(0)
const lvHeight = ref<number | null>(0)

const scaleDiff = ref<number | null>(0)

const aspectStyles = computed<StyleValue>(() => {
  if (!props.aspect) {
    return {}
  }

  return {
    aspectRatio: `${pvWidth.value} / ${pvHeight.value}`,
    transform: `scale(${scaleDiff.value})`,
    transformOrigin: 'top left',
    position: 'relative',
  }
})

type CheckoutConfirmationPayload = {
  travelerMessage: string
  paymentChoice: CheckoutPaymentChoice
  payment: {
    breakdown: CheckoutPaymentBreakdown
    paymentIntentId: string
    paymentIntentStatus: string
    currency: string
    connectedAccountId: string
  }
}

function normalizeListingId(value: unknown): string | null {
  if (Array.isArray(value)) return normalizeListingId(value[0])
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

const listingId = computed(() => normalizeListingId(route.params.id) ?? normalizeListingId(props.rawListing?.core?.id) ?? null)
const ownerStripeConnectAccountId = computed(() => getOwnerStripeConnectAccountId())

function sanitizeIdPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
}

function createReservationId(currentListingId: string, start: string, end: string) {
  const base = sanitizeIdPart(currentListingId.trim() || 'listing')
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36)
  return `reservation-${base}-${start}-${end}-${suffix}`
}

function sumFees(bookings?: Partial<RawBookings> | null): number {
  const fees = bookings?.fees ?? []
  return fees.reduce((acc, fee) => acc + (Number(fee.amount ?? 0) || 0), 0)
}

function buildLegacyReservationFromRange(currentListingId: string, range: { start: string; end: string }, bookings?: Partial<RawBookings> | null): RawBookingReservation | null {
  const nights = Math.max(1, nightsBetween(range.start, range.end))
  const total = Math.max(0, Math.round((Number(bookings?.price ?? 0) || 0) * nights + sumFees(bookings)))
  const deposit = Math.round(total * 0.3)
  const balance = Math.max(0, total - deposit)

  const [
    reservation,
  ] = normalizeReservations([
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

function mergeReservationsWithBookedDays(currentListingId: string, bookings?: Partial<RawBookings> | null): RawBookingReservation[] {
  const reservations = normalizeReservations(bookings?.reservations)
  const ranges = normalizeBookedDays(bookings?.['booked-days'])
  const knownRanges = new Set(reservations.map((reservation) => `${reservation.start}__${reservation.end}`))
  const merged = [
    ...reservations,
  ]

  for (const range of ranges) {
    const key = `${range.start}__${range.end}`
    if (knownRanges.has(key)) continue
    const legacyReservation = buildLegacyReservationFromRange(currentListingId, range, bookings)
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

  const [
    reservation,
  ] = normalizeReservations([
    {
      id: createReservationId(currentListingId, normalizedRange.start, normalizedRange.end),
      start: normalizedRange.start,
      end: normalizedRange.end,
      nights: Math.max(1, toNonNegativeInt(reservationPayload.nights, 1)),
      guestName: 'Voyageur',
      message: confirmationPayload.travelerMessage.trim(),
      guests: {
        adults: Math.max(1, toNonNegativeInt(reservationPayload.occupants.adults, 1)),
        children: toNonNegativeInt(reservationPayload.occupants.children),
        infants: toNonNegativeInt(reservationPayload.occupants.babies),
        pets: toNonNegativeInt(reservationPayload.occupants.animals),
        pmr: toNonNegativeInt(reservationPayload.occupants.pmr),
      },
      payment,
      createdAt: new Date().toISOString(),
    },
  ])

  if (!reservation) {
    throw new Error('Reservation payload normalization failed')
  }

  return reservation
}

function setAspect() {
  pvWidth.value = props.aspect?.width
  pvHeight.value = props.aspect?.height

  const container = listingView.value
  if (container) {
    lvWidth.value = container.clientWidth
    lvHeight.value = container.clientHeight
  }

  if (lvWidth.value && pvWidth.value && lvHeight.value && pvHeight.value) {
    scaleDiff.value = pvWidth.value / lvWidth.value
  }

  console.log('ListingView setAspect :', {
    pvWidth: pvWidth.value,
    pvHeight: pvHeight.value,
    lvWidth: lvWidth.value,
    lvHeight: lvHeight.value,
    diff: scaleDiff.value,
  })
}

watch(
  () => props.aspect,
  async (value) => {
    if (!value) return
    await nextTick()
    setAspect()
  },
  { immediate: true },
)

function onReserve(payload: ReservationPayload) {
  checkoutStatus.error = null
  const listing = listingData.value
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
  }
}

function cancelCheckout() {
  checkoutStatus.error = null
  checkoutPayload.value = null
}

async function confirmCheckout(payload: CheckoutConfirmationPayload) {
  const targetListingId = listingId.value
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
    const editable = await controller.fetchEditableListingBundle(targetListingId)
    const currentCore = (editable.core ?? props.rawListing?.core ?? null) as Partial<RawCore> | null
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
    }
    const currentReservations = mergeReservationsWithBookedDays(targetListingId, currentBookings)
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

    const nextReservations = normalizeReservations([
      ...currentReservations,
      createdReservation,
    ])
    const nextBookedDays = deriveBookedDaysFromReservations(nextReservations)

    await controller.patchListingDraft(targetListingId, {
      bookings: {
        ...(currentBookings ?? {}),
        reservations: nextReservations,
        'booked-days': nextBookedDays,
      },
    })

    cancelCheckout()
  } catch (error) {
    console.error('[ListingView] checkout reservation failed', error)
    checkoutStatus.error = 'Impossible de valider la réservation.'
  } finally {
    checkoutStatus.isSubmitting = false
  }
}
</script>

<template>
  <template v-if="vp.lg.value">
    <div
      :class="{ 'listing-view': true, editor: props.aspect, 'is-checkout': isCheckout }"
      ref="listingView"
      :style="aspectStyles"
    >
      <Transition name="listing-fade">
        <div
          v-if="!isCheckout"
          class="gallery"
        >
          <Gallery
            v-if="listingData"
            :medias="listingData.medias"
          />
          <template v-else><div class="skeleton">Chargement…</div></template>
        </div>
      </Transition>
      <div
        v-if="isCheckout"
        class="gallery is-placeholder"
        aria-hidden="true"
      />

      <div class="core">
        <Transition
          name="listing-swap"
          mode="out-in"
        >
          <Core
            v-if="listingData && !isCheckout"
            key="core"
            v-model:model-value="bookingRange"
            :data="listingData"
          />
          <Checkout
            v-else-if="listingData && checkoutPayload"
            key="checkout"
            :listing="listingData"
            :reservation="checkoutPayload!"
            :listing-id="listingId ?? ''"
            :connected-account-id="ownerStripeConnectAccountId"
            :is-submitting="checkoutStatus.isSubmitting"
            :submit-error="checkoutStatus.error"
            @cancel="cancelCheckout"
            @confirm="confirmCheckout"
          />
          <div
            v-else
            key="core-skeleton"
            class="skeleton"
          >
            Chargement…
          </div>
        </Transition>
      </div>

      <div class="stay">
        <Booking
          v-if="listingData"
          v-model:model-value="bookingRange"
          :price-per-night="listingData.bookings.price"
          :weekend-pricing="listingData.bookings.weekend"
          :fees="listingData.bookings.fees"
          :booked-days="listingData.bookings.bookedDays"
          :rules="listingData.bookings.rules"
          :disabled="isBookingDisabled"
          :disabled-label="bookingDisabledLabel"
          :disabled-hint="bookingDisabledHint"
          @reserve="onReserve"
        />
        <template v-else>
          <div class="skeleton">Chargement…</div>
        </template>

        <Transition name="listing-fade">
          <div v-if="!isCheckout">
            <Comments
              v-if="listingData"
              :notes="listingData.notes"
              :comments="listingData.comments"
            />
            <template v-else><div class="skeleton">Chargement…</div></template>
          </div>
        </Transition>
      </div>
    </div>
  </template>

  <template v-else>
    <div :class="{ 'listing-view': true, 'is-checkout': isCheckout }">
      <div class="main">
        <Transition name="listing-fade">
          <div
            v-if="!isCheckout"
            class="gallery"
          >
            <Gallery
              v-if="listingData"
              :medias="listingData.medias"
            />
            <template v-else><div class="skeleton">Chargement…</div></template>
          </div>
        </Transition>

        <div class="core">
          <div :class="{ panel: true, 'is-checkout': isCheckout }">
            <Transition
              name="listing-swap"
              mode="out-in"
            >
              <div
                v-if="listingData && !isCheckout"
                key="core"
              >
                <Core
                  v-model:model-value="bookingRange"
                  :data="listingData"
                />
                <Comments
                  :notes="listingData.notes"
                  :comments="listingData.comments"
                />
              </div>
              <div
                v-else-if="listingData && checkoutPayload"
                key="checkout"
                class="checkout-stack"
              >
                <Checkout
                  :listing="listingData"
                  :reservation="checkoutPayload!"
                  :listing-id="listingId ?? ''"
                  :connected-account-id="ownerStripeConnectAccountId"
                  :is-submitting="checkoutStatus.isSubmitting"
                  :submit-error="checkoutStatus.error"
                  @cancel="cancelCheckout"
                  @confirm="confirmCheckout"
                />
                <Booking
                  v-model:model-value="bookingRange"
                  :price-per-night="listingData.bookings.price"
                  :weekend-pricing="listingData.bookings.weekend"
                  :fees="listingData.bookings.fees"
                  :booked-days="listingData.bookings.bookedDays"
                  :rules="listingData.bookings.rules"
                  :disabled="isBookingDisabled"
                  :disabled-label="bookingDisabledLabel"
                  :disabled-hint="bookingDisabledHint"
                  @reserve="onReserve"
                />
              </div>
              <div
                v-else
                key="core-skeleton"
                class="skeleton"
              >
                Chargement…
              </div>
            </Transition>
          </div>
        </div>
      </div>

      <div
        v-if="!isCheckout"
        class="footer"
      >
        <span class="shape-container is-right">
          <svg
            class="shape"
            width="300"
            height="300"
            viewBox="0 0 300 300"
          >
            <path d="M 300 0 A 300 300 0 0 1 0 300 L 300 300 Z" />
          </svg>
        </span>
        <span class="shape-container is-left">
          <svg
            class="shape"
            width="300"
            height="300"
            viewBox="0 0 300 300"
          >
            <path d="M 300 0 A 300 300 0 0 1 0 300 L 300 300 Z" />
          </svg>
        </span>

        <BookingMin
          v-if="listingData"
          v-model:model-value="bookingRange"
          :price-per-night="listingData.bookings.price"
          :fees="listingData.bookings.fees"
          :booked-days="listingData.bookings.bookedDays"
          :disabled="isBookingDisabled"
          :disabled-label="bookingDisabledLabel"
        />
        <template v-else>
          <div class="skeleton">Chargement…</div>
        </template>
      </div>
    </div>
  </template>
</template>

<style lang="scss">
@use '@/views/ListingView/listing-view.scss';
</style>
