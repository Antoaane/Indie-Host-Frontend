<!-- File: src/components/DatePicker/DatePicker.vue -->

<script setup lang="ts">
import { shallowRef, computed, watch } from 'vue'
import { CalendarDate } from '@internationalized/date'
import type { RangeISO } from '@/components/DatePicker/helpers/date'
import { parseISO, toISO, todayCalendarDate } from '@/components/DatePicker/helpers/date'
import { makeIsDateDisabled } from '@/components/DatePicker/utils/range'

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
const isDateDisabled = computed(() => makeIsDateDisabled(props.disabledDates))

/* ---------- selection (v-model) ---------- */
const internal = shallowRef<{ start?: CalendarDate; end?: CalendarDate } | undefined>()

function syncInternalFromModel(value: RangeISO | null | undefined) {
  if (value?.start && value?.end) {
    const alreadySynced =
      internal.value?.start &&
      internal.value?.end &&
      toISO(internal.value.start) === value.start &&
      toISO(internal.value.end) === value.end

    if (!alreadySynced) {
      internal.value = {
        start: parseISO(value.start),
        end: parseISO(value.end),
      }
    }
  } else {
    internal.value = undefined
  }
}

syncInternalFromModel(props.modelValue)

watch(
  () => props.modelValue,
  (val) => {
    syncInternalFromModel(val)
  },
  { deep: true },
)

watch(
  internal,
  (val) => {
    if (val?.start && val?.end) {
      emit('update:modelValue', {
        start: toISO(val.start),
        end: toISO(val.end),
      })
    } else if (!val?.start && !val?.end) {
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
    v-model="internal"
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
@use '@/components/DatePicker/date-picker.scss';
</style>
