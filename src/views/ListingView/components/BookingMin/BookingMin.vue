<!-- File: src/views/ListingView/components/BookingMin/BookingMin.vue -->

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatDateLabel } from '@/views/ListingView/components/Booking/utils/labels'
import type { RangeISO } from '@/components/DatePicker/helpers/date'
import type { BookedRange, FeeItem } from '@/views/ListingView/types/listing'

const props = withDefaults(
  defineProps<{
    modelValue?: RangeISO | null
    pricePerNight: number
    fees?: FeeItem[]
    bookedDays?: BookedRange[]
  }>(),
  {
    modelValue: null,
    fees: () => [],
    bookedDays: () => [],
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
const triggerEl = ref<HTMLElement | null>(null)
const closeButtonEl = ref<HTMLButtonElement | null>(null)

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

function lockScroll() {
  document.documentElement.style.overflow = 'hidden'
}

function unlockScroll() {
  document.documentElement.style.overflow = ''
}

async function openOverlay() {
  if (overlayOpen.value) return
  overlayOpen.value = true
  lockScroll()
  await nextTick()
  closeButtonEl.value?.focus()
}

async function closeOverlay() {
  if (!overlayOpen.value) return
  overlayOpen.value = false
  unlockScroll()
  await nextTick()
  triggerEl.value?.focus?.()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && overlayOpen.value) {
    closeOverlay()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  unlockScroll()
})
</script>

<template>
  <div class="listing-booking-min">
    <div
      class="bar"
      role="button"
      tabindex="0"
      ref="triggerEl"
      aria-haspopup="dialog"
      :aria-expanded="overlayOpen"
      :aria-controls="'booking-min-dialog'"
      @click="openOverlay"
      @keydown.enter.prevent="openOverlay"
      @keydown.space.prevent="openOverlay"
    >
      <div class="info">
        <div class="price">
          <span class="amount">{{ pricePerNightLabel }}</span>
          <small>Prix indicatif</small>
        </div>

        <!-- <div class="dates">
          <span class="label">{{ rangeLabel }}</span>
        </div> -->
      </div>

      <div class="cta">
        <button
          type="button"
          class="button"
          @click.stop="openOverlay"
        >
          Réserver
        </button>
      </div>
    </div>

    <Teleport to=".footer">
      <Transition name="booking-min-overlay">
        <div
          v-if="overlayOpen"
          class="overlay"
          id="booking-min-dialog"
          role="dialog"
          aria-modal="true"
          @click.self="closeOverlay"
        >
          <div class="panel">
            <button
              ref="closeButtonEl"
              type="button"
              class="close"
              aria-label="Fermer"
              @click="closeOverlay"
            >
              ✕
            </button>

            <div class="content">
              <slot>
                <p class="placeholder"> Les détails du booking arriveront ici. </p>
              </slot>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style lang="scss">
@use '@/views/ListingView/components/BookingMin/booking-min.scss';
</style>
