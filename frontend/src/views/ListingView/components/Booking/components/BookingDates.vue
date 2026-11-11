<!-- File: src/views/ListingView/components/Booking/components/BookingDates.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import DatePicker from '@/components/DatePicker/DatePicker.vue'
import RelativeOverlay from '@/components/overlays/RelativeOverlay.vue'
import StayCalendarSheet from '@/views/ListingView/components/Booking/components/StayCalendarSheet.vue'
import type { RangeISO } from '@/components/DatePicker/helpers/date'
import { nightsBetween } from '@/domain/listings/bookings'
import { formatStayDay } from '@/views/ListingView/components/Booking/utils/labels'
import { vp } from '@/utils/viewport'

const props = withDefaults(
  defineProps<{
    open: boolean
    bookedRanges: RangeISO[]
    modelValue: RangeISO | null
    minNights?: number
  }>(),
  { minNights: 1 },
)

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

// Téléphone : calendrier plein écran, mois défilant de haut en bas. À partir de md : deux mois
// côte à côte sous les champs.
const isWide = computed(() => vp.md.value)

const startLabel = computed(() => formatStayDay(props.modelValue?.start))
const endLabel = computed(() => formatStayDay(props.modelValue?.end))

function formatDay(iso: string) {
  return formatStayDay(iso) ?? ''
}

// Ce que le voyageur a choisi, redit en clair sous le calendrier (bureau).
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
    <button
      type="button"
      class="stay-field is-start"
      aria-haspopup="dialog"
      :aria-expanded="open ? 'true' : 'false'"
      :aria-controls="isWide ? overlayId : undefined"
      @click="emit('open')"
    >
      <span class="label">Arrivée</span>
      <span
        class="value"
        :class="{ 'is-empty': !startLabel }"
      >{{ startLabel ?? 'Ajouter' }}</span>
    </button>
    <button
      type="button"
      class="stay-field is-end"
      aria-haspopup="dialog"
      :aria-expanded="open ? 'true' : 'false'"
      :aria-controls="isWide ? overlayId : undefined"
      @click="emit('open')"
    >
      <span class="label">Départ</span>
      <span
        class="value"
        :class="{ 'is-empty': !endLabel }"
      >{{ endLabel ?? 'Ajouter' }}</span>
    </button>

    <StayCalendarSheet
      v-if="!isWide"
      :open="open"
      :model-value="modelValue"
      :booked-ranges="bookedRanges"
      :min-nights="props.minNights"
      @update:model-value="selection = $event"
      @close="emit('close')"
    />

    <RelativeOverlay
      v-else
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
          :numberOfMonths="2"
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
