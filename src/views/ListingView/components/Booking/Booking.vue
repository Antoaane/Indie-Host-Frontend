<!-- File: src/views/ListingView/components/Booking/Booking.vue -->

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { RangeISO } from '@/components/DatePicker/helpers/date'
import { makeIsDateDisabled } from '@/components/DatePicker/utils/range'
import { computeNightlyPriceBreakdown } from '@/domain/listings/pricing'

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
}

const MIN_NIGHTS = 2

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

const calendarOpen = ref(false)
const guestsOpen = ref(false)
const expanded = ref(false)

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

const occupants = reactive<OccupantCounts>({
  adults: 2,
  children: 0,
  babies: 0,
  animals: 0,
  pmr: 0,
})

const isDateDisabled = computed(() => makeIsDateDisabled(bookedRanges.value))

const nightlyBreakdown = computed(() => computeNightlyPriceBreakdown({
  startISO: selection.value?.start ?? '',
  endISO: selection.value?.end ?? '',
  basePrice: pricePerNight.value,
  weekendPricing: weekendPricing.value,
}))

const nights = computed(() => nightlyBreakdown.value.nights)

const initialRange = findNextAvailableRange(MIN_NIGHTS, isDateDisabled.value)
if (!selection.value && initialRange) {
  setSelection(initialRange)
}

function isSelectedRangeValid() {
  return isSelectedRangeValidUtil(selection.value, nights.value, isDateDisabled.value)
}

watch(bookedRanges, () => {
  if (!selection.value || !isSelectedRangeValid()) {
    setSelection(findNextAvailableRange(MIN_NIGHTS, isDateDisabled.value))
  }
})

watch(
  () => selection.value,
  (val) => {
    if (val?.start && val?.end) {
      if (!isSelectedRangeValid()) {
        setSelection(findNextAvailableRange(MIN_NIGHTS, isDateDisabled.value))
        return
      }
      calendarOpen.value = false
    }
  },
  { deep: true },
)

const travelerCount = computed(() => occupants.adults + occupants.children)
const occupantLabel = computed(() => buildOccupantLabel(occupants, travelerCount.value))

const rangeLabel = computed(() => buildRangeLabel(selection.value, nights.value))

const nightlyTotal = computed(() => nightlyBreakdown.value.nightlyTotal)
const feesTotal = computed(() => fees.value.reduce((acc, fee) => acc + (Number.isFinite(fee.amount) ? fee.amount : 0), 0))
const total = computed(() => nightlyTotal.value + feesTotal.value)

const currency = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

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
        amount: currency.format(nightlyTotal.value),
      })
    }
  }

  if (!list.length && nights.value > 0) {
    list.push({
      label: `${nights.value} nuit${nights.value > 1 ? 's' : ''} (${currency.format(pricePerNight.value)} par nuit)`,
      amount: currency.format(nightlyTotal.value),
    })
  }
  fees.value.forEach((fee) => {
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

function updateCount(key: OccupantKey, delta: number) {
  const next = occupants[key] + delta
  const min = key === 'adults' ? 1 : 0
  occupants[key] = Math.max(min, next)
}

function reserve() {
  if (props.disabled) return
  if (!selection.value?.start || !selection.value?.end || !nights.value) {
    calendarOpen.value = true
    return
  }

  const payload: ReservationPayload = {
    startISO: selection.value?.start ?? null,
    endISO: selection.value?.end ?? null,
    nights: nights.value,
    occupants: { ...occupants },
    fees: fees.value,
    total: total.value,
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
          :occupants="occupants"
          :open="guestsOpen"
          :update-count="updateCount"
          @close="guestsOpen = false"
          @toggle="toggleGuests"
        />
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
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/ListingView/components/Booking/booking.scss';
</style>
