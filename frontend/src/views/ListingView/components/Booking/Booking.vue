<!-- File: src/views/ListingView/components/Booking/Booking.vue -->

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { RangeISO } from '@/components/DatePicker/helpers/date'
import { makeIsDateDisabled } from '@/components/DatePicker/utils/range'
import {
  clampOccupantsToRules,
  computeReservationPricing,
  resolveListingReservationRules,
  validateReservationAgainstRules,
  type ListingReservationRules,
} from '@/domain/listings/reservationRules'

import BookingCta from '@/views/ListingView/components/Booking/components/BookingCta.vue'
import BookingDates from '@/views/ListingView/components/Booking/components/BookingDates.vue'
import BookingGuests from '@/views/ListingView/components/Booking/components/BookingGuests.vue'
import BookingSummary from '@/views/ListingView/components/Booking/components/BookingSummary.vue'
import { buildOccupantLabel, buildRangeLabel, type OccupantCounts } from '@/views/ListingView/components/Booking/utils/labels'
import { findNextRange as findNextAvailableRange, isSelectedRangeValid as isSelectedRangeValidUtil } from '@/views/ListingView/components/Booking/utils/range'
import type { BookedRange, FeeItem, WeekendPricingModel } from '@/views/ListingView/types/listing'

type OccupantKey = keyof OccupantCounts

type ReservationPayload = {
  startISO: string | null
  endISO: string | null
  nights: number
  occupants: Record<OccupantKey, number>
  fees: FeeItem[]
  total: number
  pricing?: {
    nightlySubtotal: number
    nightlyDiscountTotal: number
    nightlyDiscountPercent: number
    discountThresholdNights: number | null
    nightlyTotal: number
    averageNightlyPrice: number
    feesTotal: number
    extraGuestsTotal: number
  }
}

const props = withDefaults(
  defineProps<{
    pricePerNight: number
    weekendPricing?: WeekendPricingModel | null
    fees?: FeeItem[]
    bookedDays?: BookedRange[]
    modelValue?: RangeISO | null
    disabled?: boolean
    disabledLabel?: string
    disabledHint?: string
    rules?: ListingReservationRules
  }>(),
  {
    pricePerNight: 0,
    weekendPricing: null,
    fees: () => [],
    bookedDays: () => [],
    modelValue: null,
    disabled: false,
    disabledLabel: undefined,
    disabledHint: undefined,
    rules: () => resolveListingReservationRules({}),
  },
)

const emit = defineEmits<{
  (e: 'reserve', payload: ReservationPayload): void
  (e: 'update:modelValue', value: RangeISO | null): void
}>()

const pricePerNight = computed(() => props.pricePerNight)
const weekendPricing = computed(() => props.weekendPricing ?? null)
const fees = computed<FeeItem[]>(() => props.fees ?? [])
const bookedRanges = computed<RangeISO[]>(() =>
  props.bookedDays.map((range) => ({
    start: range.start,
    end: range.end,
  })),
)

const currency = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const calendarOpen = ref(false)
const guestsOpen = ref(false)
const expanded = ref(false)
const reservationError = ref<string | null>(null)

const selection = computed<RangeISO | null>({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

function setSelection(range: RangeISO | null) {
  const current = props.modelValue
  if (range && current?.start === range.start && current?.end === range.end) return
  if (!range && !current) return
  emit('update:modelValue', range)
}

const occupancyRules = computed(() => props.rules.occupancy)
const stayRules = computed(() => props.rules.stay)
const extraGuestRules = computed(() => props.rules.extraGuests)
const minNights = computed(() => Math.max(1, Number(stayRules.value.minNights) || 1))

const occupants = reactive<OccupantCounts>(
  clampOccupantsToRules(
    {
      adults: 2,
      children: 0,
      babies: 0,
      animals: 0,
      pmr: 0,
    },
    occupancyRules.value,
  ),
)

watch(
  () => occupancyRules.value,
  (nextRules) => {
    const clamped = clampOccupantsToRules(occupants, nextRules)
    occupants.adults = clamped.adults
    occupants.children = clamped.children
    occupants.babies = clamped.babies
    occupants.animals = clamped.animals
    occupants.pmr = clamped.pmr
  },
  { immediate: true, deep: true },
)

const isDateDisabled = computed(() => makeIsDateDisabled(bookedRanges.value))

const pricingBreakdown = computed(() => computeReservationPricing({
  startISO: selection.value?.start ?? null,
  endISO: selection.value?.end ?? null,
  basePrice: pricePerNight.value,
  weekendPricing: weekendPricing.value,
  fees: fees.value,
  occupants,
  rules: props.rules,
}))

const nightlyBreakdown = computed(() => pricingBreakdown.value.nightly)
const nights = computed(() => pricingBreakdown.value.nightly.nights)
const travelerCount = computed(() => pricingBreakdown.value.travelerCount)
const total = computed(() => pricingBreakdown.value.total)

function isSelectedRangeValid() {
  return isSelectedRangeValidUtil(selection.value, nights.value, isDateDisabled.value)
}

watch(
  [
    bookedRanges,
    minNights,
  ],
  () => {
    if (!selection.value || !isSelectedRangeValid()) {
      setSelection(findNextAvailableRange(minNights.value, isDateDisabled.value))
    }
  },
  { immediate: true },
)

watch(
  () => selection.value,
  (val) => {
    reservationError.value = null
    if (val?.start && val?.end) {
      if (!isSelectedRangeValid()) {
        setSelection(findNextAvailableRange(minNights.value, isDateDisabled.value))
        return
      }
      calendarOpen.value = false
    }
  },
  { deep: true },
)

const adultsDynamicMax = computed(() =>
  Math.max(
    occupancyRules.value.adultsMin,
    Math.min(
      occupancyRules.value.adultsMax,
      occupancyRules.value.capacity - occupants.children,
    ),
  ),
)

const childrenDynamicMax = computed(() =>
  Math.max(
    0,
    Math.min(
      occupancyRules.value.childrenMax,
      occupancyRules.value.capacity - occupants.adults,
    ),
  ),
)

const guestRows = computed(() => [
  {
    key: 'adults' as const,
    label: 'Adultes',
    description: '13 ans et plus',
    value: occupants.adults,
    min: occupancyRules.value.adultsMin,
    max: adultsDynamicMax.value,
    hint: `Minimum ${occupancyRules.value.adultsMin} · Maximum ${occupancyRules.value.adultsMax}`,
  },
  {
    key: 'children' as const,
    label: 'Enfants',
    description: '2 a 12 ans',
    value: occupants.children,
    min: 0,
    max: childrenDynamicMax.value,
    hint: occupancyRules.value.childrenMax > 0
      ? `Maximum ${occupancyRules.value.childrenMax}`
      : 'Non autorisé pour cette annonce',
  },
  {
    key: 'babies' as const,
    label: 'Bebes',
    description: 'Moins de 2 ans',
    value: occupants.babies,
    min: 0,
    max: occupancyRules.value.babiesMax,
    hint: occupancyRules.value.babiesMax > 0
      ? `Maximum ${occupancyRules.value.babiesMax}`
      : 'Non autorisé pour cette annonce',
  },
  {
    key: 'animals' as const,
    label: 'Animaux',
    description: 'Chien, chat...',
    value: occupants.animals,
    min: 0,
    max: occupancyRules.value.animalsMax,
    hint: occupancyRules.value.animalsMax > 0
      ? `Maximum ${occupancyRules.value.animalsMax}`
      : 'Non autorisé pour cette annonce',
  },
  {
    key: 'pmr' as const,
    label: 'Personnes PMR',
    description: 'Besoin d amenagement',
    value: occupants.pmr,
    min: 0,
    max: occupancyRules.value.pmrMax,
    hint: occupancyRules.value.pmrMax > 0
      ? `Maximum ${occupancyRules.value.pmrMax}`
      : 'Non autorisé pour cette annonce',
  },
])

function resolveCounterBounds(key: OccupantKey) {
  if (key === 'adults') {
    return {
      min: occupancyRules.value.adultsMin,
      max: adultsDynamicMax.value,
    }
  }
  if (key === 'children') {
    return {
      min: 0,
      max: childrenDynamicMax.value,
    }
  }
  if (key === 'babies') {
    return {
      min: 0,
      max: occupancyRules.value.babiesMax,
    }
  }
  if (key === 'animals') {
    return {
      min: 0,
      max: occupancyRules.value.animalsMax,
    }
  }
  return {
    min: 0,
    max: occupancyRules.value.pmrMax,
  }
}

function updateCount(key: OccupantKey, delta: number) {
  reservationError.value = null
  const bounds = resolveCounterBounds(key)
  const next = occupants[key] + delta
  occupants[key] = Math.max(bounds.min, Math.min(bounds.max, next))
}

const occupantLabel = computed(() => buildOccupantLabel(occupants, travelerCount.value))
const rangeLabel = computed(() => buildRangeLabel(selection.value, nights.value))

const travelerHint = computed(() =>
  `Capacité : ${occupancyRules.value.capacity} voyageurs max (adultes + enfants).`,
)

const stayHint = computed(() =>
  stayRules.value.maxNights === null
    ? `Séjour minimum : ${stayRules.value.minNights} nuit${stayRules.value.minNights > 1 ? 's' : ''}.`
    : `Séjour : ${stayRules.value.minNights}-${stayRules.value.maxNights} nuits.`,
)

const extraGuestHint = computed(() =>
  extraGuestRules.value.enabled
    ? `Voyageur supplementaire: ${currency.format(extraGuestRules.value.price)} / pers / nuit au dela de ${extraGuestRules.value.threshold}.`
    : null,
)

const bookingRuleHint = computed(() => [
  travelerHint.value,
  stayHint.value,
  extraGuestHint.value,
].filter(Boolean).join(' '))

const priceBreakdown = computed(() => {
  const list: Array<{ label: string; amount: string }> = []
  if (nights.value > 0) {
    const breakdown = nightlyBreakdown.value
    if (weekendPricing.value?.enabled) {
      if (breakdown.weekdayNights > 0) {
        list.push({
          label: `${breakdown.weekdayNights} nuit${breakdown.weekdayNights > 1 ? 's' : ''} en semaine (${currency.format(breakdown.weekdayPrice)} par nuit)`,
          amount: currency.format(breakdown.weekdayTotal),
        })
      }

      if (breakdown.weekendNights > 0) {
        list.push({
          label: `${breakdown.weekendNights} nuit${breakdown.weekendNights > 1 ? 's' : ''} week-end (${currency.format(breakdown.weekendPrice)} par nuit)`,
          amount: currency.format(breakdown.weekendTotal),
        })
      }
    } else {
      list.push({
        label: `${nights.value} nuit${nights.value > 1 ? 's' : ''} (${currency.format(pricePerNight.value)} par nuit)`,
        amount: currency.format(breakdown.nightlySubtotal),
      })
    }
  }

  if (!list.length && nights.value > 0) {
    list.push({
      label: `${nights.value} nuit${nights.value > 1 ? 's' : ''} (${currency.format(pricePerNight.value)} par nuit)`,
      amount: currency.format(nightlyBreakdown.value.nightlySubtotal),
    })
  }

  if (pricingBreakdown.value.nightly.durationDiscountTotal > 0) {
    const threshold = pricingBreakdown.value.nightly.appliedDurationDiscountTier?.minNights
    const thresholdLabel = threshold ? `dès ${threshold} nuit${threshold > 1 ? 's' : ''}` : 'long séjour'
    list.push({
      label: `Réduction ${pricingBreakdown.value.nightly.durationDiscountPercent}% (${thresholdLabel})`,
      amount: `−${currency.format(pricingBreakdown.value.nightly.durationDiscountTotal)}`,
    })
  }

  if (pricingBreakdown.value.extraGuestsTotal > 0) {
    list.push({
      label: `${pricingBreakdown.value.extraGuestsCount} voyageur${pricingBreakdown.value.extraGuestsCount > 1 ? 's' : ''} supplementaire${pricingBreakdown.value.extraGuestsCount > 1 ? 's' : ''}`,
      amount: currency.format(pricingBreakdown.value.extraGuestsTotal),
    })
  }

  pricingBreakdown.value.fees.forEach((fee) => {
    list.push({
      label: fee.name,
      amount: currency.format(fee.amount),
    })
  })

  return list
})

const pricePerNightLabel = computed(() => {
  const breakdown = nightlyBreakdown.value
  if (breakdown.nights <= 0) {
    return `${currency.format(pricePerNight.value)} / nuit`
  }

  if (breakdown.weekendNights > 0 && breakdown.weekdayNights > 0) {
    return `${currency.format(breakdown.averageNightlyPrice)} / nuit (moy.)`
  }

  if (breakdown.weekendNights > 0) {
    return `${currency.format(breakdown.weekendPrice)} / nuit`
  }

  return `${currency.format(breakdown.weekdayPrice)} / nuit`
})

function openCalendar() {
  if (!expanded.value) expanded.value = true
  guestsOpen.value = false
  calendarOpen.value = true
}

function toggleGuests() {
  calendarOpen.value = false
  guestsOpen.value = !guestsOpen.value
}

function reserve() {
  if (props.disabled) return
  reservationError.value = null

  const validation = validateReservationAgainstRules({
    startISO: selection.value?.start ?? null,
    endISO: selection.value?.end ?? null,
    occupants,
    rules: props.rules,
  })

  if (validation.errors.length > 0 || !validation.range) {
    reservationError.value = validation.errors[0] ?? 'Selection invalide.'
    calendarOpen.value = true
    return
  }

  const payload: ReservationPayload = {
    startISO: validation.range.startISO,
    endISO: validation.range.endISO,
    nights: validation.range.nights,
    occupants: { ...validation.occupants },
    fees: pricingBreakdown.value.fees,
    total: pricingBreakdown.value.total,
    pricing: {
      nightlySubtotal: Math.round(pricingBreakdown.value.nightly.nightlySubtotal),
      nightlyDiscountTotal: Math.round(pricingBreakdown.value.nightly.durationDiscountTotal),
      nightlyDiscountPercent: pricingBreakdown.value.nightly.durationDiscountPercent,
      discountThresholdNights: pricingBreakdown.value.nightly.appliedDurationDiscountTier?.minNights ?? null,
      nightlyTotal: Math.round(pricingBreakdown.value.nightly.nightlyTotal),
      averageNightlyPrice: pricingBreakdown.value.nightly.averageNightlyPrice,
      feesTotal: pricingBreakdown.value.feesTotal,
      extraGuestsTotal: pricingBreakdown.value.extraGuestsTotal,
    },
  }
  emit('reserve', payload)
}
</script>

<template>
  <section
    id="booking"
    class="listing-booking"
  >
    <div class="card">
      <div class="header">
        <h2>Vous réservez</h2>
        <transition name="price-toggle">
          <span
            v-if="!expanded"
            class="price"
          >
            {{ pricePerNightLabel }}
          </span>
        </transition>
      </div>

      <div class="fields">
        <BookingDates
          v-model:model-value="selection"
          :booked-ranges="bookedRanges"
          :open="calendarOpen"
          :range-label="rangeLabel"
          @close="calendarOpen = false"
          @open="openCalendar"
        />

        <BookingGuests
          :occupant-label="occupantLabel"
          :rows="guestRows"
          :open="guestsOpen"
          :update-count="updateCount"
          @close="guestsOpen = false"
          @toggle="toggleGuests"
        />

        <p class="booking-rules-hint">
          {{ bookingRuleHint }}
        </p>
      </div>

      <BookingSummary
        :currency="currency"
        :expanded="expanded"
        :price-breakdown="priceBreakdown"
        :total="total"
      />

      <BookingCta
        :nights="nights"
        :disabled="props.disabled"
        :disabled-label="props.disabledLabel"
        :disabled-hint="props.disabledHint"
        @reserve="reserve"
      />

      <p
        v-if="reservationError"
        class="booking-error"
      >
        {{ reservationError }}
      </p>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/ListingView/components/Booking/booking.scss';
</style>
