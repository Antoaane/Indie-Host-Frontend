<!-- File: src/views/CreateListing/components/panels/PricingPanels/BasePricingPanel.vue -->

<script setup lang="ts">
import { computed, watch } from 'vue'
import type { RawBookings } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import { clampInteger, formatValidationMessage, parseOptionalInteger } from '@/utils/inputValidation'
import StepperInput from '@/components/inputs/StepperInput.vue'

type PricingWeekend = {
  enabled?: boolean
  price?: number | null
  percent?: number | null
}

type PricingExtraGuests = {
  price?: number | null
  threshold?: number | null
}

type PricingSettings = {
  weekend?: PricingWeekend
  extraGuests?: PricingExtraGuests
}

const props = defineProps<{
  bookings?: Partial<RawBookings> | null
  showExtraGuests?: boolean
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const pricing = computed<PricingSettings>(() => (props.bookings as any)?.pricing ?? {})
const weekend = computed<PricingWeekend>(() => pricing.value.weekend ?? {})
const extraGuests = computed<PricingExtraGuests>(() => pricing.value.extraGuests ?? {})
const pricingLimits = editorStatic.validation.pricing
const weekendPercentMax = 200

const pricePerNight = computed(() => clampMoney(props.bookings?.price))
const weekendEnabled = computed(() => Boolean(weekend.value.enabled))
const weekendPrice = computed(() => clampMoney(weekend.value.price))
const weekendPercent = computed(() => {
  const rawPercent = weekend.value.percent
  if (Number.isFinite(Number(rawPercent))) {
    return clampPercent(rawPercent)
  }

  return deriveWeekendPercent(pricePerNight.value, weekendPrice.value)
})
const extraGuestPrice = computed(() => clampMoney(extraGuests.value.price))
const extraGuestThreshold = computed(() => (Number.isFinite(Number(extraGuests.value.threshold)) ? clampInteger(extraGuests.value.threshold, pricingLimits.moneyMin, pricingLimits.extraGuestsThresholdMax, pricingLimits.moneyMin) : null))

const panelContent = editorStatic.panels.pricing.base
const baseHint = computed(() =>
  formatValidationMessage(props.showExtraGuests ? pricingLimits.messages.baseHint : pricingLimits.messages.baseHintNoExtraGuests, {
    moneyMin: pricingLimits.moneyMin,
    moneyMax: pricingLimits.moneyMax,
    extraGuestsThresholdMax: pricingLimits.extraGuestsThresholdMax,
  }),
)

watch(
  [weekendEnabled, pricePerNight],
  ([enabled, basePrice]) => {
    if (!enabled) return

    const nextPercent = weekendPercent.value
    const nextPrice = computeWeekendPrice(basePrice, nextPercent)
    const hasStoredPercent = Number.isFinite(Number(weekend.value.percent))

    if (nextPrice === weekendPrice.value && hasStoredPercent) return

    updateWeekend({
      price: nextPrice,
      percent: nextPercent,
    })
  },
  { immediate: true },
)

function setPricePerNight(next: number) {
  const normalized = clampMoney(next)
  if (normalized === pricePerNight.value) return
  emit('patch', { bookings: { price: normalized } })
}

function updatePricing(next: Partial<PricingSettings>) {
  emit('patch', {
    bookings: {
      pricing: {
        ...pricing.value,
        ...next,
      },
    } as any,
  })
}

function updateWeekend(patch: Partial<PricingWeekend>) {
  const nextPatch = {
    ...patch,
    ...(Object.prototype.hasOwnProperty.call(patch, 'price') ? { price: clampMoney(patch.price) } : {}),
    ...(Object.prototype.hasOwnProperty.call(patch, 'percent') ? { percent: clampPercent(patch.percent) } : {}),
  }

  updatePricing({
    weekend: {
      ...weekend.value,
      ...nextPatch,
    },
  })
}

function setWeekendPrice(next: number) {
  const normalizedPrice = Math.max(pricePerNight.value, clampMoney(next))
  updateWeekend({
    price: normalizedPrice,
    percent: deriveWeekendPercent(pricePerNight.value, normalizedPrice),
  })
}

function setWeekendPercent(next: number) {
  const normalizedPercent = clampPercent(next)
  updateWeekend({
    percent: normalizedPercent,
    price: computeWeekendPrice(pricePerNight.value, normalizedPercent),
  })
}

function updateExtraGuests(patch: Partial<PricingExtraGuests>) {
  const hasThreshold = Object.prototype.hasOwnProperty.call(patch, 'threshold')
  const nextPatch = {
    ...patch,
    ...(Object.prototype.hasOwnProperty.call(patch, 'price') ? { price: clampMoney(patch.price) } : {}),
    ...(hasThreshold
      ? {
          threshold: patch.threshold === null ? null : clampInteger(patch.threshold, pricingLimits.moneyMin, pricingLimits.extraGuestsThresholdMax, pricingLimits.moneyMin),
        }
      : {}),
  }

  updatePricing({
    extraGuests: {
      ...extraGuests.value,
      ...nextPatch,
    },
  })
}

function parseOptionalNumber(raw: string): number | null {
  return parseOptionalInteger(raw, pricingLimits.moneyMin, pricingLimits.extraGuestsThresholdMax)
}

function clampPercent(value: unknown): number {
  return clampInteger(value, 0, weekendPercentMax, 0)
}

function clampMoney(value: unknown): number {
  return clampInteger(value, pricingLimits.moneyMin, pricingLimits.moneyMax, pricingLimits.moneyMin)
}

function computeWeekendPrice(basePrice: number, percent: number): number {
  if (basePrice <= 0) return 0
  return clampMoney(Math.round(basePrice * (1 + percent / 100)))
}

function deriveWeekendPercent(basePrice: number, weekendNightPrice: number): number {
  if (basePrice <= 0 || weekendNightPrice <= basePrice) return 0
  return clampPercent(Math.round(((weekendNightPrice - basePrice) / basePrice) * 100))
}
</script>

<template>
  <section class="create-base-pricing-panel">
    <div class="header">
      <h2>{{ panelContent.title }}</h2>
      <h3>{{ panelContent.subtitle }}</h3>
    </div>

    <div class="body">
      <div class="field">
        <StepperInput
          :value="pricePerNight"
          :min="pricingLimits.moneyMin"
          :max="pricingLimits.moneyMax"
          :suffix="panelContent.pricePerNightSuffix"
          value-font-size="clamp(3.5rem, 10vw, 5rem)"
          suffix-font-size="clamp(1.5rem, 4vw, 2rem)"
          @input="setPricePerNight($event.number)"
        />
      </div>

      <label class="toggle">
        <input
          type="checkbox"
          :checked="weekendEnabled"
          @change="updateWeekend({ enabled: ($event.target as HTMLInputElement).checked })"
        />
        <span>{{ panelContent.weekendToggle }}</span>
      </label>

      <div
        v-if="weekendEnabled"
        class="field"
      >
        <div class="field-label">
          <p>{{ panelContent.weekendPriceLabel }}</p>
        </div>
        <div class="weekend-grid">
          <StepperInput
            :value="weekendPrice"
            :min="pricingLimits.moneyMin"
            :max="pricingLimits.moneyMax"
            :suffix="panelContent.weekendPriceSuffix"
            value-font-size="clamp(3rem, 8vw, 5rem)"
            suffix-font-size="clamp(1.35rem, 3.5vw, 2rem)"
            @input="setWeekendPrice($event.number)"
          />
          <StepperInput
            :value="weekendPercent"
            min="0"
            :max="weekendPercentMax"
            :suffix="panelContent.weekendPercentSuffix"
            value-font-size="clamp(3rem, 8vw, 5rem)"
            suffix-font-size="clamp(1.35rem, 3.5vw, 2rem)"
            @input="setWeekendPercent($event.number)"
          />
        </div>
        <div class="field-label is-slider-label">
          <p>{{ panelContent.weekendSliderLabel }}</p>
          <span>{{ weekendPercent }} {{ panelContent.weekendPercentSuffix }}</span>
        </div>
        <input
          class="range"
          type="range"
          min="0"
          :max="weekendPercentMax"
          step="1"
          :value="weekendPercent"
          @input="setWeekendPercent(Number(($event.target as HTMLInputElement).value))"
        />
      </div>

      <div
        v-if="props.showExtraGuests !== false"
        class="field"
      >
        <div class="field-label">
          <p>{{ panelContent.extraGuestsLabel }}</p>
        </div>
        <div class="row">
          <StepperInput
            :value="extraGuestPrice"
            :min="pricingLimits.moneyMin"
            :max="pricingLimits.moneyMax"
            :suffix="panelContent.extraGuestsSuffix"
            value-font-size="clamp(3rem, 8vw, 5rem)"
            suffix-font-size="clamp(1.35rem, 3.5vw, 2rem)"
            @input="updateExtraGuests({ price: $event.number })"
          />
          <div class="input">
            <input
              :value="extraGuestThreshold ?? ''"
              type="number"
              :min="pricingLimits.moneyMin"
              :max="pricingLimits.extraGuestsThresholdMax"
              step="1"
              inputmode="numeric"
              :placeholder="panelContent.extraGuestsPlaceholder"
              @input="updateExtraGuests({ threshold: parseOptionalNumber(($event.target as HTMLInputElement).value) })"
            />
          </div>
        </div>
      </div>
      <p class="hint">
        {{ baseHint }}
      </p>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/CreateListing/components/panels/PricingPanels/base-pricing-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/components/inputs' as inputs;
@use '@/styles/components/buttons' as buttons;
@use '@/views/CreateListing/components/panels/panel.scss' as *;

.create-base-pricing-panel {
  @extend %panel;

  min-width: 0;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;
    min-width: 0;

    > .field {
      @extend %panel-field;
      min-width: 0;
      padding: var(--layout-gap-sm);
      border-radius: 1.25rem;
      background: linear-gradient(180deg, rgba($secondary, 0.04) 0%, rgba($secondary, 0.02) 100%);
      border: 1px solid rgba($secondary, 0.08);
    }

    .field-label {
      @extend %panel-field-label;
    }

    .toggle {
      @include buttons.checkbox-label(white);
      width: fit-content;
      max-width: 100%;
      border: 1px solid rgba($secondary, 0.06);
    }

    .ui-stepper-input {
      min-width: 0;
      max-width: 100%;
    }

    .row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: var(--layout-gap-xs);
      align-items: center;

      > * {
        min-width: 0;
      }

      > .input {
        @include inputs.field($theme: base);
      }

      @media screen and (max-width: 768px) {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .weekend-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: var(--layout-gap-xs);
      align-items: start;

      > * {
        min-width: 0;
      }

      @media screen and (max-width: 768px) {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .field-label.is-slider-label {
      margin-top: 0.2rem;
    }

    .range {
      width: 100%;
    }

    .hint {
      margin: 0;
      margin-top: auto;
      @include little-text($thin: true);
      color: rgba($secondary-text, 0.58);
    }
  }
}
</style>
