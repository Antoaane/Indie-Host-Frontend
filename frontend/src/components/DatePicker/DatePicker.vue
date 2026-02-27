<!-- File: src/components/DatePicker/DatePicker.vue -->

<script setup lang="ts">
import { shallowRef, computed, watch } from 'vue'
import { CalendarDate } from '@internationalized/date'
import type { RangeISO } from '@/components/DatePicker/helpers/date'
import { parseISO, toISO, toNum, todayCalendarDate } from '@/components/DatePicker/helpers/date'
import { makeIsDateDisabled } from '@/components/DatePicker/utils/range'

const props = withDefaults(
  defineProps<{
    numberOfMonths?: number
    disabledDates?: RangeISO[]
    modelValue?: RangeISO | null
    readOnly?: boolean
    allowNavigationInReadOnly?: boolean
    restrictToFuture?: boolean
    allowDisabledModelValue?: boolean
  }>(),
  {
    numberOfMonths: 2,
    disabledDates: () => [],
    modelValue: null,
    readOnly: false,
    allowNavigationInReadOnly: false,
    restrictToFuture: true,
    allowDisabledModelValue: false,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: RangeISO | null): void
}>()

/* ---------- disabled ---------- */
const isDateDisabled = computed(() => makeIsDateDisabled(props.disabledDates, { allowPast: !props.restrictToFuture }))

/* ---------- selection (v-model) ---------- */
const internal = shallowRef<any>()

function isRangeValid(
  start: CalendarDate,
  end: CalendarDate,
  options?: { allowDisabledBoundaries?: boolean },
): boolean {
  if (toNum(start) > toNum(end)) return false
  if (options?.allowDisabledBoundaries) return true
  if (isDateDisabled.value(start) || isDateDisabled.value(end)) return false
  return true
}

function syncInternalFromModel(value: RangeISO | null | undefined) {
  if (value?.start && value?.end) {
    try {
      const start = parseISO(value.start)
      const end = parseISO(value.end)
      if (!isRangeValid(start, end, { allowDisabledBoundaries: props.allowDisabledModelValue })) {
        internal.value = undefined
        return
      }

      const alreadySynced =
        internal.value?.start &&
        internal.value?.end &&
        toISO(internal.value.start) === value.start &&
        toISO(internal.value.end) === value.end

      if (!alreadySynced) {
        internal.value = { start, end }
      }
    } catch {
      internal.value = undefined
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
  () => [
    props.disabledDates,
    props.restrictToFuture,
    props.allowDisabledModelValue,
  ],
  () => {
    syncInternalFromModel(props.modelValue)
  },
  { deep: true },
)

watch(
  internal,
  (val) => {
    if (props.readOnly) return
    if (val?.start && val?.end) {
      if (!isRangeValid(val.start, val.end)) return
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
const minValue = computed(() => (props.restrictToFuture ? today : undefined))
</script>

<template>
  <UCalendar
    v-model="internal"
    :is-date-disabled="isDateDisabled"
    :min-value="minValue"
    :number-of-months="numberOfMonths"
    :year-controls="false"
    :class="{
      'is-readonly': props.readOnly,
      'is-readonly-with-navigation': props.readOnly && props.allowNavigationInReadOnly,
    }"
    range
    locale="fr"
    :ui="{
      root: 'date-picker',
      header: 'header',
      heading: 'heading',
      body: 'body',
      grid: 'grid',
      gridRow: 'grid-row',
      gridWeekDaysRow: 'weekdays-row',
      gridBody: 'grid-body',
      headCell: 'head-cell',
      cell: 'cell',
      cellTrigger: 'cell-trigger',
    }"
  />
</template>

<style lang="scss">
@use '@/components/DatePicker/date-picker.scss';
</style>
