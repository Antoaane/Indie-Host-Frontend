<!-- File: src/views/ListingView/components/ListingCore/components/DatePicker/DatePicker.vue -->

<script setup lang="ts">
// DEPS
import { shallowRef } from 'vue'
import type { DateValue } from '@internationalized/date'
import { CalendarDate } from '@internationalized/date'

const modelValue = shallowRef({
  start: new CalendarDate(2022, 1, 1),
  end: new CalendarDate(2022, 1, 9),
})

const isDateDisabled = (date: DateValue) => {
  return date.day >= 10 && date.day <= 16
}
</script>

<template>
  <UCalendar
    v-model="modelValue"
    :is-date-disabled="isDateDisabled"
    range
    locale="fr"
  />
</template>

<style lang="scss">
@use '@/views/ListingView/components/ListingCore/components/DatePicker/date-picker.scss';
</style>
