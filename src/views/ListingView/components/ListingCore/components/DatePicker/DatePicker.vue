<!-- File: src/views/ListingView/components/ListingCore/components/DatePicker/DatePicker.vue -->

<script setup lang="ts">
import { shallowRef, computed, watch } from 'vue'
import type { DateValue } from '@internationalized/date'
import { CalendarDate } from '@internationalized/date'

type ISO = string
type RangeISO = { start: ISO; end: ISO }

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

/* ---------- helpers ---------- */
const toNum = (d: { year: number; month: number; day: number }) => d.year * 10000 + d.month * 100 + d.day

const parseISO = (iso: ISO) => {
  const [
    y,
    m,
    d,
  ] = iso.split('-').map(Number)
  return new CalendarDate(y, m, d)
}

const fmt2 = (n: number) => String(n).padStart(2, '0')
const toISO = (d?: DateValue | null): ISO => (d ? `${d.year}-${fmt2(d.month)}-${fmt2(d.day)}` : '')

/* ---------- disabled ranges ---------- */
const rangesNum = computed(() =>
  props.disabledDates.map(({ start, end }) => {
    const a = toNum(parseISO(start))
    const b = toNum(parseISO(end))
    return a <= b ? { start: a, end: b } : { start: b, end: a }
  }),
)

const isDateDisabled = (date: DateValue) => {
  const n = toNum(date)
  return rangesNum.value.some((r) => n >= r.start && n <= r.end)
}

/* ---------- selection (v-model) ---------- */
// valeur interne pour <UCalendar> (CalendarDate)
const internal = shallowRef<{ start?: CalendarDate; end?: CalendarDate } | undefined>()

// init depuis modelValue
if (props.modelValue?.start && props.modelValue?.end) {
  internal.value = {
    start: parseISO(props.modelValue.start),
    end: parseISO(props.modelValue.end),
  }
}

// renvoyer au parent en ISO à chaque changement
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
</script>

<template>
  <UCalendar
    :v-model="internal"
    :is-date-disabled="isDateDisabled"
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
