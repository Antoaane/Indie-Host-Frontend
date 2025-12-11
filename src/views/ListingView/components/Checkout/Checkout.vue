<!-- File: src/views/ListingView/components/Checkout/Checkout.vue -->

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { RangeISO } from '@/components/DatePicker/helpers/date'
import { makeIsDateDisabled } from '@/components/DatePicker/utils/range'

import CheckoutCta from '@/views/ListingView/components/Checkout/components/CheckoutCta.vue'
import CheckoutDates from '@/views/ListingView/components/Checkout/components/CheckoutDates.vue'
import CheckoutGuests from '@/views/ListingView/components/Checkout/components/CheckoutGuests.vue'
import CheckoutSummary from '@/views/ListingView/components/Checkout/components/CheckoutSummary.vue'
import { buildOccupantLabel, buildRangeLabel, type OccupantCounts } from '@/views/ListingView/components/Checkout/utils/labels'
import {
  findNextRange as findNextAvailableRange,
  isSelectedRangeValid as isSelectedRangeValidUtil,
} from '@/views/ListingView/components/Checkout/utils/range'
import type { BookedRange, FeeItem } from '@/views/ListingView/types/listing'

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
    fees?: FeeItem[]
    bookedDays?: BookedRange[]
    modelValue?: RangeISO | null
  }>(),
  {
    pricePerNight: 0,
    fees: () => [],
    bookedDays: () => [],
    modelValue: null,
  },
)

const emit = defineEmits<{
  (e: 'reserve', payload: ReservationPayload): void
  (e: 'update:modelValue', value: RangeISO | null): void
}>()

const pricePerNight = computed(() => props.pricePerNight)
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

const nights = computed(() => {
  if (!selection.value?.start || !selection.value?.end) return 0
  const start = new Date(selection.value.start)
  const end = new Date(selection.value.end)
  const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  return diff > 0 ? Math.round(diff) : 0
})

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

const nightlyTotal = computed(() => nights.value * pricePerNight.value)
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

const pricePerNightLabel = computed(() => `${currency.format(pricePerNight.value)} / nuit`)

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
  <section id="checkout">
    <div class="checkout-card">
      <div class="checkout-card__header">
        <h2>Vous réservez</h2>
        <transition name="price-toggle">
          <span
            v-if="!expanded"
            class="checkout-card__price"
          >
            {{ pricePerNightLabel }}
          </span>
        </transition>
      </div>

      <div class="checkout-card__fields">
        <CheckoutDates
          v-model:model-value="selection"
          :booked-ranges="bookedRanges"
          :open="calendarOpen"
          :range-label="rangeLabel"
          @close="calendarOpen = false"
          @open="openCalendar"
        />

        <CheckoutGuests
          :occupant-label="occupantLabel"
          :occupants="occupants"
          :open="guestsOpen"
          :update-count="updateCount"
          @close="guestsOpen = false"
          @toggle="toggleGuests"
        />
      </div>

      <CheckoutSummary
        :currency="currency"
        :expanded="expanded"
        :price-breakdown="priceBreakdown"
        :total="total"
      />

      <CheckoutCta
        :nights="nights"
        @reserve="reserve"
      />
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/ListingView/components/Checkout/checkout.scss';
</style>
