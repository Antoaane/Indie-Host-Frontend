<!-- File: src/views/ListingView/components/ListingCore/components/DatePicker/DatePicker.vue -->

<script setup lang="ts">
import { shallowRef, computed, watch } from 'vue'
import { CalendarDate } from '@internationalized/date'
import type { RangeISO } from '@/views/ListingView/components/ListingCore/components/DatePicker/helpers/date'
import { parseISO, toISO, todayCalendarDate } from '@/views/ListingView/components/ListingCore/components/DatePicker/helpers/date'
import { buildNumericRanges, makeIsDateDisabled } from '@/views/ListingView/components/ListingCore/components/DatePicker/utils/range'

const props = withDefaults(
  defineProps<{
    numberOfMonths?: number
    disabledDates?: RangeISO[]
    modelValue?: RangeISO | null
  }>(),
  {
    numberOfMonths: 2,
    disabledDates: () => [],
    modelValue: null,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: RangeISO | null): void
}>()

/* ---------- disabled ---------- */
const rangesNum = computed(() => buildNumericRanges(props.disabledDates))
const isDateDisabled = makeIsDateDisabled(props.disabledDates)

/* ---------- selection (v-model) ---------- */
const internal = shallowRef<{ start?: CalendarDate; end?: CalendarDate } | undefined>()

if (props.modelValue?.start && props.modelValue?.end) {
  internal.value = {
    start: parseISO(props.modelValue.start),
    end: parseISO(props.modelValue.end),
  }
}

watch(
  internal,
  (val) => {
    if (val?.start && val?.end) {
      emit('update:modelValue', {
        start: toISO(val.start),
        end: toISO(val.end),
      })
    } else {
      emit('update:modelValue', null)
    }
  },
  { deep: true },
)

/* min-value pour interdire la sélection avant aujourd'hui */
const today = todayCalendarDate()
</script>

<template>
  <UCalendar
    :v-model="internal"
    :is-date-disabled="isDateDisabled"
    :min-value="today"
    :number-of-months="numberOfMonths"
    :year-controls="false"
    range
    locale="fr"
    :ui="{
      root: 'cal-root',
      header: 'cal-header',
      heading: 'cal-heading',
      body: 'cal-body',
      grid: 'cal-grid',
      gridRow: 'cal-gridRow',
      gridWeekDaysRow: 'cal-gridWeekDaysRow',
      gridBody: 'cal-gridBody',
      headCell: 'cal-headCell',
      cell: 'cal-cell',
      cellTrigger: 'cal-cellTrigger',
    }"
  />
</template>

<style lang="scss">
@use '@/views/ListingView/components/ListingCore/components/DatePicker/date-picker.scss';
</style>
