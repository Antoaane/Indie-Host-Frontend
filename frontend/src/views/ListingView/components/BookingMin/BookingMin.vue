<!-- File: src/views/ListingView/components/BookingMin/BookingMin.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import AbsoluteOverlay from '@/components/overlays/AbsoluteOverlay.vue'
import { formatDateLabel } from '@/views/ListingView/components/Booking/utils/labels'
import type { RangeISO } from '@/components/DatePicker/helpers/date'
import type { BookedRange, FeeItem } from '@/views/ListingView/types/listing'

const props = withDefaults(
  defineProps<{
    modelValue?: RangeISO | null
    pricePerNight: number
    fees?: FeeItem[]
    bookedDays?: BookedRange[]
    disabled?: boolean
    disabledLabel?: string
  }>(),
  {
    modelValue: null,
    fees: () => [],
    bookedDays: () => [],
    disabled: false,
    disabledLabel: undefined,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: RangeISO | null): void
}>()

const selection = computed<RangeISO | null>({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const overlayOpen = ref(false)

const currency = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const pricePerNightLabel = computed(() => `${currency.format(props.pricePerNight)} / nuit`)

const rangeLabel = computed(() => {
  if (selection.value?.start && selection.value?.end) {
    return `Du ${formatDateLabel(selection.value.start)} au ${formatDateLabel(selection.value.end)}`
  }
  return 'Sélectionnez vos dates'
})

function openOverlay() {
  if (props.disabled) return
  if (overlayOpen.value) return
  overlayOpen.value = true
}

function closeOverlay() {
  if (!overlayOpen.value) return
  overlayOpen.value = false
}
</script>

<template>
  <div class="listing-booking-min">
    <div
      class="bar"
      role="button"
      :tabindex="props.disabled ? -1 : 0"
      aria-haspopup="dialog"
      :aria-expanded="overlayOpen"
      :aria-controls="'booking-min-dialog'"
      :class="{ 'is-disabled': props.disabled }"
      :aria-disabled="props.disabled"
      @click="openOverlay"
      @keydown.enter.prevent="openOverlay"
      @keydown.space.prevent="openOverlay"
    >
      <div class="info">
        <div class="price">
          <span class="amount">{{ pricePerNightLabel }}</span>
        </div>

        <!-- <div class="dates">
          <span class="label">{{ rangeLabel }}</span>
        </div> -->
      </div>

      <div class="cta">
        <button
          type="button"
          class="button"
          :disabled="props.disabled"
          @click.stop="openOverlay"
        >
          {{ props.disabled && props.disabledLabel ? props.disabledLabel : 'Réserver' }}
        </button>
      </div>
    </div>

    <small class="price-indicative">Prix indicatif</small>

    <AbsoluteOverlay
      id="booking-min-dialog"
      class="booking-min-overlay"
      :open="overlayOpen"
      aria-label="R&eacute;servation"
      @close="closeOverlay"
    >
      <div class="panel">
        <button
          type="button"
          class="close"
          aria-label="Fermer"
          @click="closeOverlay" title="Fermer"
        >
          ✕
        </button>

        <div class="content">
          <slot>
            <p class="placeholder"> Les détails du booking arriveront ici. </p>
          </slot>
        </div>
      </div>
    </AbsoluteOverlay>
  </div>
</template>

<style lang="scss">
@use '@/views/ListingView/components/BookingMin/booking-min.scss';
</style>
