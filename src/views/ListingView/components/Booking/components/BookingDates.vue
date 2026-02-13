<!-- File: src/views/ListingView/components/Booking/components/BookingDates.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import DatePicker from '@/components/DatePicker/DatePicker.vue'
import RelativeOverlay from '@/components/overlays/RelativeOverlay.vue'
import type { RangeISO } from '@/components/DatePicker/helpers/date'

const props = defineProps<{
  open: boolean
  rangeLabel: string
  bookedRanges: RangeISO[]
  modelValue: RangeISO | null
}>()

const emit = defineEmits<{
  (e: 'open'): void
  (e: 'close'): void
  (e: 'update:modelValue', value: RangeISO | null): void
}>()

const selection = computed<RangeISO | null>({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const calendarLayer = ref<HTMLElement | null>(null)
</script>

<template>
  <div
    ref="calendarLayer"
    class="listing-booking-dates"
  >
    <div class="group is-single">
      <div class="btn-primary__white__full">
        <button
          type="button"
          class="field is-full"
          @click="emit('open')"
          v-html="rangeLabel"
        />
      </div>
    </div>

    <RelativeOverlay
      class="listing-booking-dates-overlay"
      :open="open"
      :anchor="calendarLayer"
      placement="bottom-start"
      :offset="6"
      :z-index="10002"
      @close="emit('close')"
    >
      <div class="calendar">
        <DatePicker
          v-model:model-value="selection"
          :disabled-dates="bookedRanges"
          :numberOfMonths="2"
        />
      </div>
    </RelativeOverlay>
  </div>
</template>
