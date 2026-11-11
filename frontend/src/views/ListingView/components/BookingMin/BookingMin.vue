<!-- File: src/views/ListingView/components/BookingMin/BookingMin.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { X } from 'lucide-vue-next'
import AbsoluteOverlay from '@/components/overlays/AbsoluteOverlay.vue'
import { formatStayRange } from '@/views/ListingView/components/Booking/utils/labels'
import type { RangeISO } from '@/components/DatePicker/helpers/date'

// Barre de réservation du téléphone, collée au bas de l'écran : total du séjour choisi (frais
// compris) et ses dates à gauche, « Réserver » à droite (comme Airbnb). Elle ouvre la fenêtre de
// réservation (dates, voyageurs, détail du prix), qui reprend le module de réservation du bureau.
// Avant : un prix par nuit sans les frais, suivi de « Prix indicatif » sous la barre.
const props = withDefaults(
  defineProps<{
    modelValue?: RangeISO | null
    pricePerNight: number
    /** Total du séjour choisi, calculé comme dans le module de réservation et sur le serveur. */
    quote?: { total: number; nights: number } | null
    disabled?: boolean
    disabledLabel?: string
  }>(),
  {
    modelValue: null,
    quote: null,
    disabled: false,
    disabledLabel: undefined,
  },
)

const overlayOpen = ref(false)

const currency = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const amountLabel = computed(() => currency.format(props.quote ? props.quote.total : props.pricePerNight))
const amountSuffix = computed(() => (props.quote ? 'au total' : '/ nuit'))

// Le séjour choisi (dates proposées d'office : les premières disponibles), sinon une invitation.
const stayLabel = computed(() => {
  const range = formatStayRange(props.modelValue)
  if (!range || !props.quote) return 'Choisissez vos dates'
  const { nights } = props.quote
  return `${range} · ${nights} ${nights > 1 ? 'nuits' : 'nuit'}`
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
      :class="{ 'is-disabled': props.disabled }"
    >
      <button
        type="button"
        class="info"
        aria-haspopup="dialog"
        :aria-expanded="overlayOpen"
        aria-controls="booking-min-dialog"
        :disabled="props.disabled"
        @click="openOverlay"
      >
        <span class="price"><strong>{{ amountLabel }}</strong> {{ amountSuffix }}</span>
        <span class="stay">{{ stayLabel }}</span>
      </button>

      <div class="cta">
        <button
          type="button"
          :disabled="props.disabled"
          aria-haspopup="dialog"
          @click="openOverlay"
        >
          {{ props.disabled && props.disabledLabel ? props.disabledLabel : 'Réserver' }}
        </button>
      </div>
    </div>

    <AbsoluteOverlay
      id="booking-min-dialog"
      class="booking-min-overlay"
      :open="overlayOpen"
      aria-label="Réservation"
      @close="closeOverlay"
    >
      <div class="panel">
        <button
          type="button"
          class="close"
          aria-label="Fermer"
          title="Fermer"
          @click="closeOverlay"
        >
          <X
            :size="20"
            aria-hidden="true"
          />
        </button>

        <div class="content">
          <slot />
        </div>
      </div>
    </AbsoluteOverlay>
  </div>
</template>

<style lang="scss">
@use '@/views/ListingView/components/BookingMin/booking-min.scss';
</style>
