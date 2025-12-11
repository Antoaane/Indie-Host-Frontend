<!-- File: src/views/ListingView/components/CheckoutMin/CheckoutMin.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'
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
  overlayOpen.value = true
}

function closeOverlay() {
  overlayOpen.value = false
}
</script>

<template>
  <div class="checkout-min">
    <div
      class="checkout-min__bar"
      role="button"
      tabindex="0"
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

    <Teleport to="body">
      <transition name="checkout-min__fade">
        <div
          v-if="overlayOpen"
          class="checkout-min__overlay"
        >
          <div
            class="checkout-min__backdrop"
            @click="closeOverlay"
          />

          <transition name="checkout-min__slide">
            <div
              v-if="overlayOpen"
              class="checkout-min__panel"
            >
              <button
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
          </transition>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<style lang="scss">
@use '@/views/ListingView/components/CheckoutMin/checkout-min.scss';
</style>
