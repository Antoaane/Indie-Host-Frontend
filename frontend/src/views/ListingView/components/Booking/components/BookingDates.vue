<!-- File: src/views/ListingView/components/Booking/components/BookingDates.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import DatePicker from '@/components/DatePicker/DatePicker.vue'
import RelativeOverlay from '@/components/overlays/RelativeOverlay.vue'
import type { RangeISO } from '@/components/DatePicker/helpers/date'
import { nightsBetween } from '@/domain/listings/bookings'
import { vp } from '@/utils/viewport'

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
const overlayId = `booking-dates-overlay-${Math.random().toString(36).slice(2, 10)}`

// Téléphone : un seul mois à la fois. Deux mois empilés dépassaient la hauteur de l'écran.
const monthsCount = computed(() => (vp.md.value ? 2 : 1))

function formatDay(iso: string) {
  const [
    year,
    month,
    day,
  ] = iso.split('-').map(Number)
  if (!year || !month || !day) return ''
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

// Ce que le voyageur a choisi, redit en clair sous le calendrier.
const summary = computed(() => {
  const range = props.modelValue
  if (!range?.start || !range.end) return 'Choisissez votre date d’arrivée, puis celle de départ.'

  const nights = nightsBetween(range.start, range.end)
  if (nights <= 0) return `Arrivée le ${formatDay(range.start)} : choisissez le départ.`
  return `${formatDay(range.start)} → ${formatDay(range.end)} · ${nights} ${nights > 1 ? 'nuits' : 'nuit'}`
})
</script>

<template>
  <div
    ref="calendarLayer"
    class="listing-booking-dates"
  >
    <div class="group is-single">
      <div class="btn-primary__white__full">
        <button
          type="button"
          class="field is-full"
          aria-haspopup="dialog"
          :aria-expanded="open ? 'true' : 'false'"
          :aria-controls="overlayId"
          @click="emit('open')"
          v-html="rangeLabel"
        />
      </div>
    </div>

    <RelativeOverlay
      class="listing-booking-dates-overlay"
      :open="open"
      :anchor="calendarLayer"
      :id="overlayId"
      placement="bottom-start"
      :offset="6"
      :z-index="10002"
      aria-label="Choisir les dates du séjour"
      @close="emit('close')"
    >
      <div class="calendar">
        <DatePicker
          v-model:model-value="selection"
          :disabled-dates="bookedRanges"
          :numberOfMonths="monthsCount"
        />

        <div class="calendar-footer">
          <div class="text">
            <p
              class="summary"
              aria-live="polite"
            >
              {{ summary }}
            </p>
            <p class="legend">Les jours barrés ne sont pas disponibles.</p>
          </div>
          <div class="confirm">
            <button
              type="button"
              @click="emit('close')"
            >
              Valider
            </button>
          </div>
        </div>
      </div>
    </RelativeOverlay>
  </div>
</template>
