<!-- File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/FeesPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { RawBookings } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import { clampInteger, formatValidationMessage, normalizeTextInput, parseOptionalInteger } from '@/utils/inputValidation'

type FeeDraft = {
  name?: string
  amount?: number
  code?: string
}

const panelContent = editorStatic.panels.pricing.fees
const CLEANING_CODE = 'cleaning'
const LINEN_CODE = 'linen'
const CLEANING_LABEL = panelContent.cleaning
const LINEN_LABEL = panelContent.linen
const pricingLimits = editorStatic.validation.pricing
const feesHint = computed(() =>
  formatValidationMessage(pricingLimits.messages.feesHint, {
    moneyMin: pricingLimits.moneyMin,
    moneyMax: pricingLimits.moneyMax,
    customFeeNameMax: pricingLimits.customFeeNameMax,
  }),
)

const props = defineProps<{
  bookings?: Partial<RawBookings> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const fees = computed<FeeDraft[]>(() => (props.bookings?.fees as FeeDraft[] | undefined) ?? [])

type FeeEntry = {
  fee: FeeDraft
  index: number
}

function isReservedFee(fee: FeeDraft) {
  const code = fee.code
  if (code === CLEANING_CODE || code === LINEN_CODE) return true
  return fee.name === CLEANING_LABEL || fee.name === LINEN_LABEL
}

const customFees = computed<FeeEntry[]>(() => (
  fees.value
    .map((fee, index) => (isReservedFee(fee) ? null : { fee, index }))
    .filter((entry): entry is FeeEntry => Boolean(entry))
))

function updateFees(next: FeeDraft[]) {
  emit('patch', { bookings: { fees: next } as any })
}

function resolveFeeIndex(code: string, fallbackLabel: string) {
  const byCode = fees.value.findIndex((fee) => fee.code === code)
  if (byCode >= 0) return byCode
  return fees.value.findIndex((fee) => fee.name === fallbackLabel)
}

function setReservedFee(code: string, label: string, amount: number | null) {
  const next = [...fees.value]
  const index = resolveFeeIndex(code, label)

  if (amount === null || !Number.isFinite(amount)) {
    if (index >= 0) next.splice(index, 1)
    updateFees(next)
    return
  }

  const payload: FeeDraft = {
    ...(index >= 0 ? next[index] : {}),
    code,
    name: label,
    amount: clampInteger(amount, pricingLimits.moneyMin, pricingLimits.moneyMax, pricingLimits.moneyMin),
  }

  if (index >= 0) {
    next[index] = payload
  } else {
    next.push(payload)
  }
  updateFees(next)
}

function parseOptionalNumber(raw: string): number | null {
  return parseOptionalInteger(raw, pricingLimits.moneyMin, pricingLimits.moneyMax)
}

const cleaningFee = computed(() => {
  const index = resolveFeeIndex(CLEANING_CODE, CLEANING_LABEL)
  const value = index >= 0 ? fees.value[index]?.amount : null
  return Number.isFinite(Number(value)) ? Number(value) : null
})

const linenFee = computed(() => {
  const index = resolveFeeIndex(LINEN_CODE, LINEN_LABEL)
  const value = index >= 0 ? fees.value[index]?.amount : null
  return Number.isFinite(Number(value)) ? Number(value) : null
})

function addCustomFee() {
  updateFees([
    ...fees.value,
    { name: '', amount: 0, code: 'custom' },
  ])
}

function updateCustomFee(index: number, patch: Partial<FeeDraft>) {
  const next = [...fees.value]
  if (!next[index]) return
  const nextPatch = {
    ...patch,
    ...(typeof patch.name === 'string'
      ? { name: normalizeTextInput(patch.name, pricingLimits.customFeeNameMax) }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(patch, 'amount')
      ? { amount: clampInteger(patch.amount, pricingLimits.moneyMin, pricingLimits.moneyMax, pricingLimits.moneyMin) }
      : {}),
  }
  next[index] = {
    ...next[index],
    ...nextPatch,
  }
  updateFees(next)
}

function removeCustomFee(index: number) {
  updateFees(fees.value.filter((_, idx) => idx !== index))
}
</script>

<template>
  <section class="editor-fees-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
      <div class="field">
        <div class="field-label">
          <p>{{ panelContent.cleaning }}</p>
        </div>
        <div class="stepper with-suffix">
          <div class="btn">
            <button
              type="button"
              @click="setReservedFee(CLEANING_CODE, CLEANING_LABEL, Math.max(pricingLimits.moneyMin, (cleaningFee ?? 0) - 1))"
            >
              −
            </button>
          </div>
          <input
            class="value"
            type="number"
            :min="pricingLimits.moneyMin"
            :max="pricingLimits.moneyMax"
            step="1"
            inputmode="numeric"
            :value="cleaningFee ?? ''"
            @input="setReservedFee(CLEANING_CODE, CLEANING_LABEL, parseOptionalNumber(($event.target as HTMLInputElement).value))"
          />
          <span class="suffix">{{ panelContent.perStaySuffix }}</span>
          <div class="btn">
            <button
              type="button"
              @click="setReservedFee(CLEANING_CODE, CLEANING_LABEL, (cleaningFee ?? 0) + 1)"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div class="field">
        <div class="field-label">
          <p>{{ panelContent.linen }}</p>
        </div>
        <div class="stepper with-suffix">
          <div class="btn">
            <button
              type="button"
              @click="setReservedFee(LINEN_CODE, LINEN_LABEL, Math.max(pricingLimits.moneyMin, (linenFee ?? 0) - 1))"
            >
              −
            </button>
          </div>
          <input
            class="value"
            type="number"
            :min="pricingLimits.moneyMin"
            :max="pricingLimits.moneyMax"
            step="1"
            inputmode="numeric"
            :value="linenFee ?? ''"
            @input="setReservedFee(LINEN_CODE, LINEN_LABEL, parseOptionalNumber(($event.target as HTMLInputElement).value))"
          />
          <span class="suffix">{{ panelContent.perStaySuffix }}</span>
          <div class="btn">
            <button
              type="button"
              @click="setReservedFee(LINEN_CODE, LINEN_LABEL, (linenFee ?? 0) + 1)"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div class="custom-fees">
        <div class="custom-header">
          <p>{{ panelContent.customTitle }}</p>
          <div class="add-fee">
            <button
              type="button"
              @click="addCustomFee"
            >
              {{ panelContent.addCustom }}
            </button>
          </div>
        </div>

        <div
          v-for="entry in customFees"
          :key="entry.index"
          class="custom-row"
        >
          <div class="input">
            <input
              :value="entry.fee.name ?? ''"
              type="text"
              :maxlength="pricingLimits.customFeeNameMax"
              :placeholder="panelContent.customPlaceholder"
              autocomplete="off"
              inputmode="text"
              @input="updateCustomFee(entry.index, { name: ($event.target as HTMLInputElement).value })"
            />
          </div>
          <div class="stepper">
            <div class="btn">
              <button
                type="button"
                @click="updateCustomFee(entry.index, { amount: Math.max(pricingLimits.moneyMin, Number(entry.fee.amount ?? 0) - 1) })"
              >
                −
              </button>
            </div>
            <input
              class="value"
              type="number"
              :min="pricingLimits.moneyMin"
              :max="pricingLimits.moneyMax"
              step="1"
              inputmode="numeric"
              :value="entry.fee.amount ?? 0"
              @input="updateCustomFee(entry.index, { amount: ($event.target as HTMLInputElement).valueAsNumber })"
            />
            <div class="btn">
              <button
                type="button"
                @click="updateCustomFee(entry.index, { amount: Number(entry.fee.amount ?? 0) + 1 })"
              >
                +
              </button>
            </div>
          </div>
          <div class="remove">
            <button
              type="button"
              @click="removeCustomFee(entry.index)"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
      <p class="hint">
        {{ feesHint }}
      </p>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/fees-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/components/inputs' as inputs;
@use '@/styles/components/buttons' as buttons;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-fees-panel {
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

    .stepper {
      @include inputs.stepper($theme: base);
    }

    .stepper.with-suffix {
      align-items: center;

      > .suffix {
        font-size: 0.85rem;
        color: rgba($secondary, 0.6);
        white-space: nowrap;
      }
    }

    .custom-fees {
      display: flex;
      flex-direction: column;
      gap: var(--layout-gap-xs);
    }

    .custom-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--layout-gap-xs);

      > p {
        margin: 0;
        font-weight: 600;
        color: $secondary;
      }

      > .add-fee {
        @include buttons.primary($theme: black, $padding: false);

        > button {
          padding: 0.4rem 0.8rem;
          font-size: 0.85rem;
          font-weight: 600;
        }
      }
    }

    .custom-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 150px) 40px;
      gap: var(--layout-gap-xs);
      align-items: center;

      > .input {
        @include inputs.field($theme: base);
      }

      > .remove {
        @include buttons.primary($theme: light, $padding: false);
        width: 40px;
        height: 40px;

        > * {
          height: 100%;
          padding: 0;
          font-size: 1rem;
          font-weight: 700;
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
