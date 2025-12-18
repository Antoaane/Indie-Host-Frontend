<!-- File: src/views/ListingView/components/Checkout/components/CheckoutDates.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onClickOutside } from '@vueuse/core'
import DatePicker from '@/components/DatePicker/DatePicker.vue'
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
onClickOutside(calendarLayer, () => emit('close'))
</script>

<template>
  <div
    ref="calendarLayer"
    class="listing-checkout-dates"
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

    <transition name="fade">
      <div
        v-if="open"
        class="calendar"
      >
        <DatePicker
          v-model:model-value="selection"
          :disabled-dates="bookedRanges"
          :numberOfMonths="2"
        />
      </div>
    </transition>
  </div>
</template>
