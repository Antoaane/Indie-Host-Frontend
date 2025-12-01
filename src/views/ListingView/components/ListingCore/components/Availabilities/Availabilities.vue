<!-- File: src/views/ListingView/components/ListingCore/components/Availabilities/Availabilities.vue -->

<script lang="ts" setup>
import { computed } from 'vue'
import DatePicker from '@/components/DatePicker/DatePicker.vue'
import type { BookingsModel } from '@/views/ListingView/types/listing'
import type { RangeISO } from '@/components/DatePicker/helpers/date'

const props = defineProps<{
  data: BookingsModel
  staticContent: {
    availability: string
  }
}>()

const disabledDates = computed<RangeISO[]>(() => (props.data?.bookedDays ?? []).map(({ start, end }) => ({ start, end })))
</script>

<template>
  <div class="availabilities-listing__comp">
    <h2>
      {{ staticContent.availability }}
    </h2>
    <DatePicker :disabled-dates="disabledDates" />
  </div>
</template>

<style lang="scss">
@use '@/views/ListingView/components/ListingCore/components/Availabilities/availabilities.scss';
</style>
