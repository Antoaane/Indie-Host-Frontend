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
    class="checkout-card__dates"
  >
    <div class="checkout-card__field-group checkout-card__field-group--single">
      <div class="btn-primary__white__full">
        <button
          type="button"
          class="checkout-card__field checkout-card__field--full"
          @click="emit('open')"
          v-html="rangeLabel"
        />
      </div>
    </div>

    <transition name="fade">
      <div
        v-if="open"
        class="checkout-card__calendar"
      >
        <DatePicker
          v-model:model-value="selection"
          :disabled-dates="bookedRanges"
          :number-of-months="2"
        />
      </div>
    </transition>
  </div>
</template>
