<!-- File: src/views/ListingView/components/CheckoutMin/CheckoutMin.vue -->

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatDateLabel } from '@/views/ListingView/components/Checkout/utils/labels'
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
  <div class="checkout-min">
    <div
      class="checkout-min__bar"
      role="button"
      tabindex="0"
      ref="triggerEl"
      aria-haspopup="dialog"
      :aria-expanded="overlayOpen"
      :aria-controls="'checkout-min-dialog'"
      @click="openOverlay"
      @keydown.enter.prevent="openOverlay"
      @keydown.space.prevent="openOverlay"
    >
      <div class="checkout-min__info">
        <div class="checkout-min__price">
          <span class="checkout-min__price-amount">{{ pricePerNightLabel }}</span>
          <small>Prix indicatif</small>
        </div>

        <!-- <div class="checkout-min__dates">
          <span class="checkout-min__dates-label">{{ rangeLabel }}</span>
        </div> -->
      </div>

      <div class="checkout-min__cta-container">
        <button
          type="button"
          class="checkout-min__cta"
          @click.stop="openOverlay"
        >
          Réserver
        </button>
      </div>
    </div>

    <Teleport to="footer">
      <Transition name="checkout-min-overlay">
        <div
          v-if="overlayOpen"
          class="checkout-min__overlay"
          id="checkout-min-dialog"
          role="dialog"
          aria-modal="true"
          @click.self="closeOverlay"
        >
          <div class="checkout-min__panel">
            <button
              ref="closeButtonEl"
              type="button"
              class="checkout-min__close"
              aria-label="Fermer"
              @click="closeOverlay"
            >
              ✕
            </button>

            <div class="checkout-min__content">
              <slot>
                <p class="checkout-min__placeholder"> Les détails du checkout arriveront ici. </p>
              </slot>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style lang="scss">
@use '@/views/ListingView/components/CheckoutMin/checkout-min.scss';
</style>
