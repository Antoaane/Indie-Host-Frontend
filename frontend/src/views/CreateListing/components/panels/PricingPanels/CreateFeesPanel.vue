<!-- File: src/views/CreateListing/components/panels/PricingPanels/CreateFeesPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { RawBookings } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import CreateListingStepperInput from '@/views/CreateListing/components/panels/inputs/CreateListingStepperInput.vue'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import { clampInteger, formatValidationMessage, normalizeTextInput, parseOptionalInteger, resolveTextMaxLength, shouldDisplayTextLimit } from '@/utils/inputValidation'

type FeeDraft = {
  name?: string
  amount?: number | null
  code?: string
}

const panelContent = editorStatic.panels.pricing.createFees
const pricingLimits = editorStatic.validation.pricing
const textDefaults = editorStatic.validation.defaults.simpleText
const customFeeNameMax = resolveTextMaxLength(pricingLimits.customFeeNameMax, textDefaults)
const showCustomFeeNameLimit = shouldDisplayTextLimit(customFeeNameMax, textDefaults)
const feesHintTemplate = showCustomFeeNameLimit ? pricingLimits.messages.feesHint : pricingLimits.messages.feesHintNoTextLimit

const feesHint = computed(() =>
  formatValidationMessage(feesHintTemplate, {
    moneyMin: pricingLimits.moneyMin,
    moneyMax: pricingLimits.moneyMax,
    customFeeNameMax,
  }),
)

const props = defineProps<{
  bookings?: Partial<RawBookings> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const fees = computed<FeeDraft[]>(() => (props.bookings?.fees as FeeDraft[] | undefined) ?? [])

function updateFees(next: FeeDraft[]) {
  emit('patch', { bookings: { fees: next } as any })
}

function addFee() {
  updateFees([
    ...fees.value,
    { name: '', amount: 0, code: 'custom' },
  ])
}

function updateFee(index: number, patch: Partial<FeeDraft>) {
  const next = [
    ...fees.value,
  ]
  if (!next[index]) return

  const nextPatch = {
    ...patch,
    ...(typeof patch.name === 'string'
      ? {
          name: normalizeTextInput(patch.name, customFeeNameMax),
        }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(patch, 'amount')
      ? {
          amount: clampInteger(patch.amount, pricingLimits.moneyMin, pricingLimits.moneyMax, pricingLimits.moneyMin),
        }
      : {}),
  }

  next[index] = {
    ...next[index],
    ...nextPatch,
  }

  updateFees(next)
}

function removeFee(index: number) {
  updateFees(fees.value.filter((_, currentIndex) => currentIndex !== index))
}

function parseOptionalAmount(raw: string): number | null {
  return parseOptionalInteger(raw, pricingLimits.moneyMin, pricingLimits.moneyMax)
}
</script>

<template>
  <section class="create-fees-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
      <div class="add-fee">
        <button
          type="button"
          @click="addFee"
        >
          {{ panelContent.addFee }}
        </button>
      </div>

      <p
        v-if="!fees.length"
        class="fees-empty"
      >
        {{ panelContent.empty }}
      </p>

      <div
        v-for="(fee, index) in fees"
        :key="`fee-${index}`"
        class="fee-row"
      >
        <div class="input">
          <input
            :value="fee.name ?? ''"
            type="text"
            :maxlength="customFeeNameMax"
            :placeholder="panelContent.namePlaceholder"
            autocomplete="off"
            inputmode="text"
            @input="updateFee(index, { name: ($event.target as HTMLInputElement).value })"
          />
        </div>

        <CreateListingStepperInput
          :value="fee.amount ?? ''"
          :min="pricingLimits.moneyMin"
          :max="pricingLimits.moneyMax"
          :suffix="panelContent.perStaySuffix"
          @input="updateFee(index, { amount: parseOptionalAmount($event.raw) })"
        />

        <div class="remove">
          <button
            type="button"
            @click="removeFee(index)"
          >
            ✕
          </button>
        </div>
      </div>

      <p class="hint">
        {{ feesHint }}
      </p>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/CreateListing/components/panels/PricingPanels/create-fees-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/components/inputs' as inputs;
@use '@/views/CreateListing/components/panels/panel.scss' as *;

.create-fees-panel {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;

    .add-fee {
      display: flex;
      justify-content: flex-start;

      > button {
        border: none;
        background: none;
        padding: 0;
        cursor: pointer;
        font-size: 0.85rem;
        font-weight: 600;
        color: $secondary;
        text-decoration: underline;
        text-underline-offset: 0.2rem;
      }
    }

    .fees-empty {
      margin: 0;
      @include little-text($thin: false);
      color: rgba($secondary, 0.62);
    }

    .fee-row {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) auto;
      gap: var(--layout-gap-xs);
      align-items: center;

      @media screen and (max-width: 768px) {
        grid-template-columns: minmax(0, 1fr);
      }

      > .input {
        @include inputs.field($theme: base);
      }

      > .remove {
        @media screen and (max-width: 768px) {
          justify-self: flex-end;
        }

        > button {
          border: none;
          background: none;
          padding: 0.25rem;
          cursor: pointer;
          font-size: 0.95rem;
          font-weight: 600;
          color: rgba($secondary, 0.7);
          line-height: 1;
        }
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
