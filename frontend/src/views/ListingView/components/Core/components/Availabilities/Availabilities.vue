<!-- File: src/views/ListingView/components/Core/components/Availabilities/Availabilities.vue -->

<script lang="ts" setup>
import { computed } from 'vue'
import DatePicker from '@/components/DatePicker/DatePicker.vue'
import type { BookingsModel } from '@/views/ListingView/types/listing'
import type { RangeISO } from '@/components/DatePicker/helpers/date'
import { useListingViewport } from '@/views/ListingView/composables/useListingViewport'

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

const { mode } = useListingViewport()

const calendarMonthsCount = computed(() => (mode.value === 'xxl' ? 3 : 2))

const selection = computed<RangeISO | null>({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const disabledDates = computed<RangeISO[]>(() => (props.data?.bookedDays ?? []).map(({ start, end }) => ({ start, end })))
</script>

<template>
  <section class="listing-availabilities">
    <h2>
      {{ staticContent.availability }}
    </h2>
    <DatePicker
      v-model:model-value="selection"
      :disabled-dates="disabledDates"
      :numberOfMonths="calendarMonthsCount"
    />
  </section>
</template>

<style lang="scss">
/* File: src/views/ListingView/components/Core/components/Availabilities/availabilities.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.listing-availabilities {
  > h2 {
    margin-bottom: var(--layout-gap-md) !important;
    @include h2-title($gradiant: true);
  }

  > .date-picker {
    width: 100%;
    max-width: none !important;
  }
}
</style>
