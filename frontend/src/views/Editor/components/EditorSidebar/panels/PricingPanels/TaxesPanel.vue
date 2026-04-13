<!-- File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/TaxesPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import NumberStepper from '@/components/inputs/NumberStepper.vue'
import type { RawBookings } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import { clampInteger, formatValidationMessage } from '@/utils/inputValidation'

type TaxMode = 'per-person-night' | 'per-night'
type TaxDisplay = 'included' | 'added'

type PricingTaxes = {
  enabled?: boolean
  mode?: TaxMode
  amount?: number | null
  display?: TaxDisplay
}

type PricingSettings = {
  taxes?: PricingTaxes
}

const props = defineProps<{
  bookings?: Partial<RawBookings> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const pricing = computed<PricingSettings>(() => (props.bookings as any)?.pricing ?? {})
const taxes = computed<PricingTaxes>(() => pricing.value.taxes ?? {})
const pricingLimits = editorStatic.validation.pricing

const isEnabled = computed(() => Boolean(taxes.value.enabled))
const mode = computed<TaxMode>(() => taxes.value.mode ?? 'per-person-night')
const amount = computed(() => clampInteger(taxes.value.amount, pricingLimits.moneyMin, pricingLimits.taxAmountMax, pricingLimits.moneyMin))
const display = computed<TaxDisplay>(() => taxes.value.display ?? 'included')
const panelContent = editorStatic.panels.pricing.taxes
const taxesHint = computed(() =>
  formatValidationMessage(pricingLimits.messages.taxesHint, {
    moneyMin: pricingLimits.moneyMin,
    taxAmountMax: pricingLimits.taxAmountMax,
  }),
)

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

function updateTaxes(patch: Partial<PricingTaxes>) {
  const nextPatch = {
    ...patch,
    ...(Object.prototype.hasOwnProperty.call(patch, 'amount') ? { amount: clampInteger(patch.amount, pricingLimits.moneyMin, pricingLimits.taxAmountMax, pricingLimits.moneyMin) } : {}),
  }

  updatePricing({
    taxes: {
      ...taxes.value,
      ...nextPatch,
    },
  })
}
</script>

<template>
  <section class="editor-taxes-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
      <label class="toggle">
        <input
          type="checkbox"
          :checked="isEnabled"
          @change="updateTaxes({ enabled: ($event.target as HTMLInputElement).checked })"
        />
        <span>{{ panelContent.enabled }}</span>
      </label>

      <div
        v-if="isEnabled"
        class="tax-settings"
      >
        <div class="field">
          <div class="field-label">
            <p>{{ panelContent.modeLabel }}</p>
          </div>
          <div class="select">
            <select
              :value="mode"
              @change="updateTaxes({ mode: ($event.target as HTMLSelectElement).value as TaxMode })"
            >
              <option value="per-person-night">{{ panelContent.modeOptions['per-person-night'] }}</option>
              <option value="per-night">{{ panelContent.modeOptions['per-night'] }}</option>
            </select>
          </div>
        </div>

        <div class="field">
          <div class="field-label">
            <p>{{ panelContent.amountLabel }}</p>
            <span>{{ panelContent.currencySymbol }}</span>
          </div>
          <NumberStepper
            :value="amount"
            :min="pricingLimits.moneyMin"
            :max="pricingLimits.taxAmountMax"
            @decrement="updateTaxes({ amount: Math.max(pricingLimits.moneyMin, amount - 1) })"
            @input="updateTaxes({ amount: $event.number })"
            @increment="updateTaxes({ amount: amount + 1 })"
          />
        </div>
      </div>

      <div class="field">
        <div class="field-label">
          <p>{{ panelContent.displayLabel }}</p>
        </div>
        <div class="radio-group">
          <label class="radio">
            <input
              type="radio"
              name="tax-display"
              value="included"
              :checked="display === 'included'"
              @change="updateTaxes({ display: 'included' })"
            />
            <span>{{ panelContent.displayOptions.included }}</span>
          </label>
          <label class="radio">
            <input
              type="radio"
              name="tax-display"
              value="added"
              :checked="display === 'added'"
              @change="updateTaxes({ display: 'added' })"
            />
            <span>{{ panelContent.displayOptions.added }}</span>
          </label>
        </div>
      </div>
      <p class="hint">
        {{ taxesHint }}
      </p>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/taxes-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/components/inputs' as inputs;
@use '@/styles/components/buttons' as buttons;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-taxes-panel {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;

    .toggle {
      @include buttons.checkbox-label(white);
      border: 1px solid rgba($secondary, 0.06);
    }

    .tax-settings {
      display: flex;
      flex-direction: column;
      gap: var(--layout-gap-sm);
    }

    .field {
      @extend %panel-field;
    }

    .field-label {
      @extend %panel-field-label;
    }

    .select {
      @include inputs.select($theme: base);
    }

    .radio-group {
      display: grid;
      gap: var(--layout-gap-xs);
    }

    .radio {
      @include buttons.checkbox-label(white);
      border: 1px solid rgba($secondary, 0.06);

      input[type='radio'] {
        @include buttons.checkbox(white);
        border-radius: borders.$rounded;
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
