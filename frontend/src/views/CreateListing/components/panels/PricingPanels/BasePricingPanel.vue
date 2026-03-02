<!-- File: src/views/CreateListing/components/panels/PricingPanels/BasePricingPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { RawBookings } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import { clampInteger, formatValidationMessage, parseOptionalInteger } from '@/utils/inputValidation'
import CreateListingStepperInput from '@/views/CreateListing/components/panels/inputs/CreateListingStepperInput.vue'

type PricingWeekend = {
  enabled?: boolean
  price?: number | null
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

const pricePerNight = computed(() => clampMoney(props.bookings?.price))
const weekendEnabled = computed(() => Boolean(weekend.value.enabled))
const weekendPrice = computed(() => clampMoney(weekend.value.price))
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
  }

  updatePricing({
    weekend: {
      ...weekend.value,
      ...nextPatch,
    },
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

function clampMoney(value: unknown): number {
  return clampInteger(value, pricingLimits.moneyMin, pricingLimits.moneyMax, pricingLimits.moneyMin)
}
</script>

<template>
  <section class="create-base-pricing-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
      <div class="field">
        <CreateListingStepperInput
          variant="hero"
          :value="pricePerNight"
          :min="pricingLimits.moneyMin"
          :max="pricingLimits.moneyMax"
          :suffix="panelContent.pricePerNightSuffix"
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
        <CreateListingStepperInput
          variant="hero"
          :value="weekendPrice"
          :min="pricingLimits.moneyMin"
          :max="pricingLimits.moneyMax"
          :suffix="panelContent.weekendPriceSuffix"
          @input="updateWeekend({ price: $event.number })"
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
          <CreateListingStepperInput
            variant="hero"
            :value="extraGuestPrice"
            :min="pricingLimits.moneyMin"
            :max="pricingLimits.moneyMax"
            :suffix="panelContent.extraGuestsSuffix"
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

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;

    > .field {
      @extend %panel-field;
    }

    .field-label {
      @extend %panel-field-label;
    }

    .toggle {
      @include buttons.checkbox-label(white);
      border: 1px solid rgba($secondary, 0.06);
    }

    .row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: var(--layout-gap-xs);
      align-items: center;

      > .input {
        @include inputs.field($theme: base);
      }
    }

    .hint {
      margin: 0;
      @include little-text($thin: false);
      color: rgba($secondary, 0.65);
    }
  }
}
</style>
