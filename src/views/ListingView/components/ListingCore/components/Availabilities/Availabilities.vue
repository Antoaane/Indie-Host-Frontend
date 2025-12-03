<!-- File: src/views/ListingView/components/ListingCore/components/Availabilities/Availabilities.vue -->

<script lang="ts" setup>
import { computed } from 'vue'
import DatePicker from '@/components/DatePicker/DatePicker.vue'
import type { BookingsModel } from '@/views/ListingView/types/listing'
import type { RangeISO } from '@/components/DatePicker/helpers/date'
import { vp } from '@/utils/viewport'

const props = withDefaults(
  defineProps<{
    data: BookingsModel
    staticContent: {
      availability: string
    }
    modelValue?: RangeISO | null
  }>(),
  {
    modelValue: null,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: RangeISO | null): void
}>()

const selection = computed<RangeISO | null>({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const disabledDates = computed<RangeISO[]>(() => (props.data?.bookedDays ?? []).map(({ start, end }) => ({ start, end })))
</script>

<template>
  <div class="availabilities-listing__comp">
    <h2>
      {{ staticContent.availability }}
    </h2>
    <DatePicker
      v-model:model-value="selection"
      :disabled-dates="disabledDates"
      :numberOfMonths="vp.lg ? 3 : 2"
    />
  </div>
</template>

<style lang="scss">
@use '@/views/ListingView/components/ListingCore/components/Availabilities/availabilities.scss';
</style>
