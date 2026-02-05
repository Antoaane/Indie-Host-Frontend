<!-- File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/DepositPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { RawBookings } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'

type DepositType = 'info' | 'card' | 'cash' | 'check'

type PricingDeposit = {
  amount?: number | null
  type?: DepositType
}

type PricingSettings = {
  deposit?: PricingDeposit
}

const props = defineProps<{
  bookings?: Partial<RawBookings> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const pricing = computed<PricingSettings>(() => ((props.bookings as any)?.pricing ?? {}))
const deposit = computed<PricingDeposit>(() => pricing.value.deposit ?? {})

const amount = computed(() => Number(deposit.value.amount ?? 0))
const depositType = computed<DepositType>(() => deposit.value.type ?? 'info')
const panelContent = editorStatic.panels.pricing.deposit

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

function updateDeposit(patch: Partial<PricingDeposit>) {
  updatePricing({
    deposit: {
      ...deposit.value,
      ...patch,
    },
  })
}
</script>

<template>
  <section class="editor-deposit-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
      <div class="field">
        <div class="field-label">
          <p>{{ panelContent.amountLabel }}</p>
          <span>{{ panelContent.currencySymbol }}</span>
        </div>
        <div class="stepper">
          <div class="btn">
            <button
              type="button"
              @click="updateDeposit({ amount: Math.max(0, amount - 1) })"
            >
              −
            </button>
          </div>
          <input
            class="value"
            type="number"
            min="0"
            :value="amount"
            @input="updateDeposit({ amount: Math.max(0, Number(($event.target as HTMLInputElement).value)) })"
          />
          <div class="btn">
            <button
              type="button"
              @click="updateDeposit({ amount: amount + 1 })"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div class="field">
        <div class="field-label">
          <p>{{ panelContent.typeLabel }}</p>
        </div>
        <div class="select">
          <select
            :value="depositType"
            @change="updateDeposit({ type: ($event.target as HTMLSelectElement).value as DepositType })"
          >
            <option value="info">{{ panelContent.types.info }}</option>
            <option value="card">{{ panelContent.types.card }}</option>
            <option value="cash">{{ panelContent.types.cash }}</option>
            <option value="check">{{ panelContent.types.check }}</option>
          </select>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/deposit-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/components/inputs' as inputs;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-deposit-panel {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;

    .field {
      @extend %panel-field;
    }

    .field-label {
      @extend %panel-field-label;
    }

    .stepper {
      @include inputs.stepper($theme: base);
    }

    .select {
      @include inputs.select($theme: base);
    }
  }
}
</style>
