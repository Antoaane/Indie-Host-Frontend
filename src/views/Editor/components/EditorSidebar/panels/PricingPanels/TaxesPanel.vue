<!-- File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/TaxesPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { RawBookings } from '@/views/Listing/utils/fetchListingRaw'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'

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

const pricing = computed<PricingSettings>(() => ((props.bookings as any)?.pricing ?? {}))
const taxes = computed<PricingTaxes>(() => pricing.value.taxes ?? {})

const isEnabled = computed(() => Boolean(taxes.value.enabled))
const mode = computed<TaxMode>(() => taxes.value.mode ?? 'per-person-night')
const amount = computed(() => Number(taxes.value.amount ?? 0))
const display = computed<TaxDisplay>(() => taxes.value.display ?? 'included')
const panelContent = editorStatic.panels.pricing.taxes

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
  updatePricing({
    taxes: {
      ...taxes.value,
      ...patch,
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
          <div class="stepper">
            <div class="btn">
              <button
                type="button"
                @click="updateTaxes({ amount: Math.max(0, amount - 1) })"
              >
                −
              </button>
            </div>
            <input
              class="value"
              type="number"
              min="0"
              :value="amount"
              @input="updateTaxes({ amount: Math.max(0, Number(($event.target as HTMLInputElement).value)) })"
            />
            <div class="btn">
              <button
                type="button"
                @click="updateTaxes({ amount: amount + 1 })"
              >
                +
              </button>
            </div>
          </div>
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
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/taxes-panel.scss */

@use '@/styles/variables/globals' as *;
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

    .stepper {
      @include inputs.stepper($theme: base);
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
        border-radius: 999px;
      }
    }
  }
}
</style>
