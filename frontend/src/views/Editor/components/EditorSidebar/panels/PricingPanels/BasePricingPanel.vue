<!-- File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/BasePricingPanel.vue -->

<script setup lang="ts">
import { computed, watch } from 'vue'
import NumberStepper from '@/components/inputs/NumberStepper.vue'
import type { RawBookings } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import { clampInteger, formatValidationMessage, parseOptionalInteger } from '@/utils/inputValidation'

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
  <section class="editor-base-pricing-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
      <div class="field">
        <div class="field-label">
          <p>{{ panelContent.pricePerNightLabel }}</p>
          <span>{{ panelContent.pricePerNightSuffix }}</span>
        </div>
        <NumberStepper
          :value="pricePerNight"
          :min="pricingLimits.moneyMin"
          :max="pricingLimits.moneyMax"
          @decrement="setPricePerNight(pricePerNight - 1)"
          @input="setPricePerNight($event.number)"
          @increment="setPricePerNight(pricePerNight + 1)"
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
        <div class="weekend-grid">
          <div class="weekend-block">
            <div class="field-label">
              <p>{{ panelContent.weekendPriceLabel }}</p>
              <span>{{ panelContent.weekendPriceSuffix }}</span>
            </div>
            <NumberStepper
              :value="weekendPrice"
              :min="pricingLimits.moneyMin"
              :max="pricingLimits.moneyMax"
              @decrement="setWeekendPrice(weekendPrice - 1)"
              @input="setWeekendPrice($event.number)"
              @increment="setWeekendPrice(weekendPrice + 1)"
            />
          </div>

          <div class="weekend-block">
            <div class="field-label">
              <p>{{ panelContent.weekendPercentLabel }}</p>
              <span>{{ panelContent.weekendPercentSuffix }}</span>
            </div>
            <NumberStepper
              :value="weekendPercent"
              min="0"
              :max="weekendPercentMax"
              @decrement="setWeekendPercent(weekendPercent - 1)"
              @input="setWeekendPercent($event.number)"
              @increment="setWeekendPercent(weekendPercent + 1)"
            />
          </div>
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
          <span>{{ panelContent.extraGuestsSuffix }}</span>
        </div>
        <div class="row">
          <NumberStepper
            :value="extraGuestPrice"
            :min="pricingLimits.moneyMin"
            :max="pricingLimits.moneyMax"
            @decrement="updateExtraGuests({ price: Math.max(pricingLimits.moneyMin, extraGuestPrice - 1) })"
            @input="updateExtraGuests({ price: $event.number })"
            @increment="updateExtraGuests({ price: extraGuestPrice + 1 })"
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
/* File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/base-pricing-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/components/inputs' as inputs;
@use '@/styles/components/buttons' as buttons;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-base-pricing-panel {
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

      // Au doigt, le stepper passe en ligne (boutons de 44 px) : sa colonne suit son contenu.
      @media (pointer: coarse) {
        grid-template-columns: auto minmax(0, 1fr);
      }

      > .input {
        @include inputs.field($theme: base);
      }
    }

    .weekend-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: var(--layout-gap-xs);
      align-items: start;

      // Au doigt, les steppers passent en ligne (boutons de 44 px) : on les empile
      // quand deux ne tiennent plus côte à côte.
      @media (pointer: coarse) {
        @include responsive-grid-columns(10rem);
      }
    }

    .weekend-block {
      display: grid;
      gap: var(--layout-gap-xs);
      min-width: 0;
    }

    .field-label.is-slider-label {
      margin-top: 0.2rem;
    }

    .range {
      width: 100%;
    }

    .hint {
      margin: 0;
      @include little-text($thin: false);
      color: rgba($secondary, 0.65);
    }
  }
}
</style>
