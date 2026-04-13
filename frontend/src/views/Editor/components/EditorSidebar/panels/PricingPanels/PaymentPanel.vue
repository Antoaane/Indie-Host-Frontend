<!-- File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/PaymentPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { RawBookings } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import { clampInteger, formatValidationMessage, parseOptionalInteger } from '@/utils/inputValidation'

type PaymentMode = 'full' | 'deposit'
type BalanceType = 'arrival' | 'before'

type PaymentMethods = {
  card?: boolean
  sepa?: boolean
  cash?: boolean
}

type PaymentBalance = {
  type?: BalanceType
  days?: number | null
}

type PricingPayment = {
  methods?: PaymentMethods
  mode?: PaymentMode
  depositPercent?: number | null
  balance?: PaymentBalance
}

type PricingSettings = {
  payment?: PricingPayment
}

const props = defineProps<{
  bookings?: Partial<RawBookings> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const pricing = computed<PricingSettings>(() => ((props.bookings as any)?.pricing ?? {}))
const payment = computed<PricingPayment>(() => pricing.value.payment ?? {})
const balance = computed<PaymentBalance>(() => payment.value.balance ?? {})
const pricingLimits = editorStatic.validation.pricing

const methods = computed(() => ({
  card: Boolean(payment.value.methods?.card ?? true),
  sepa: Boolean(payment.value.methods?.sepa ?? false),
  cash: Boolean(payment.value.methods?.cash ?? false),
}))

const paymentMode = computed<PaymentMode>(() => payment.value.mode ?? 'full')
const depositPercent = computed(() => {
  const raw = Number(payment.value.depositPercent ?? pricingLimits.depositPercentMin)
  return clampInteger(
    raw,
    pricingLimits.depositPercentMin,
    pricingLimits.depositPercentMax,
    pricingLimits.depositPercentMin,
  )
})
const balanceType = computed<BalanceType>(() => balance.value.type ?? 'arrival')
const balanceDays = computed(() => (
  Number.isFinite(Number(balance.value.days))
    ? clampInteger(
        balance.value.days,
        pricingLimits.balanceDaysMin,
        pricingLimits.balanceDaysMax,
        pricingLimits.balanceDaysMin,
      )
    : null
))
const panelContent = editorStatic.panels.pricing.payment
const paymentHint = computed(() =>
  formatValidationMessage(pricingLimits.messages.paymentHint, {
    depositPercentMin: pricingLimits.depositPercentMin,
    depositPercentMax: pricingLimits.depositPercentMax,
    balanceDaysMin: pricingLimits.balanceDaysMin,
    balanceDaysMax: pricingLimits.balanceDaysMax,
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

function updatePayment(patch: Partial<PricingPayment>) {
  updatePricing({
    payment: {
      ...payment.value,
      ...patch,
    },
  })
}

function updateMethods(next: PaymentMethods) {
  updatePayment({
    methods: {
      ...payment.value.methods,
      ...next,
    },
  })
}

function toggleMethod(key: keyof PaymentMethods) {
  const next = { ...methods.value, [key]: !methods.value[key] }
  if (!next.card && !next.sepa && !next.cash) return
  updateMethods(next)
}

function setDepositPercent(next: number) {
  updatePayment({
    depositPercent: clampInteger(
      next,
      pricingLimits.depositPercentMin,
      pricingLimits.depositPercentMax,
      pricingLimits.depositPercentMin,
    ),
  })
}

function parseOptionalNumber(raw: string): number | null {
  return parseOptionalInteger(raw, pricingLimits.balanceDaysMin, pricingLimits.balanceDaysMax)
}
</script>

<template>
  <section class="editor-payment-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
      <div class="field">
        <div class="field-label">
          <p>{{ panelContent.methodsLabel }}</p>
        </div>
        <div class="checkbox-group">
          <label class="choice">
            <input
              type="checkbox"
              :checked="methods.card"
              @change="toggleMethod('card')"
            />
            <span>{{ panelContent.methods.card }}</span>
          </label>
          <label class="choice">
            <input
              type="checkbox"
              :checked="methods.sepa"
              @change="toggleMethod('sepa')"
            />
            <span>{{ panelContent.methods.sepa }}</span>
          </label>
          <label class="choice">
            <input
              type="checkbox"
              :checked="methods.cash"
              @change="toggleMethod('cash')"
            />
            <span>{{ panelContent.methods.cash }}</span>
          </label>
        </div>
      </div>

      <div class="field">
        <div class="field-label">
          <p>{{ panelContent.conditionsLabel }}</p>
        </div>
        <div class="radio-group">
          <label class="choice">
            <input
              type="radio"
              name="payment-mode"
              value="full"
              :checked="paymentMode === 'full'"
              @change="updatePayment({ mode: 'full' })"
            />
            <span>{{ panelContent.full }}</span>
          </label>
          <label class="choice">
            <input
              type="radio"
              name="payment-mode"
              value="deposit"
              :checked="paymentMode === 'deposit'"
              @change="updatePayment({ mode: 'deposit' })"
            />
            <span>{{ panelContent.deposit }}</span>
          </label>
        </div>
      </div>

      <div
        v-if="paymentMode === 'deposit'"
        class="deposit-settings"
      >
        <div class="field">
          <div class="field-label">
            <p>{{ panelContent.depositLabel }}</p>
            <span>{{ depositPercent }} %</span>
          </div>
          <input
            class="range"
            type="range"
            :min="pricingLimits.depositPercentMin"
            :max="pricingLimits.depositPercentMax"
            step="1"
            :value="depositPercent"
            @input="setDepositPercent(Number(($event.target as HTMLInputElement).value))"
          />
        </div>

        <div class="field">
          <div class="field-label">
            <p>{{ panelContent.balanceLabel }}</p>
          </div>
          <div class="row">
            <div class="select">
              <select
                :value="balanceType"
                @change="updatePayment({ balance: { ...balance, type: ($event.target as HTMLSelectElement).value as BalanceType } })"
              >
                <option value="arrival">{{ panelContent.balanceOptions.arrival }}</option>
                <option value="before">{{ panelContent.balanceOptions.before }}</option>
              </select>
            </div>
            <div
              v-if="balanceType === 'before'"
              class="input"
            >
              <input
                :value="balanceDays ?? ''"
                type="number"
                :min="pricingLimits.balanceDaysMin"
                :max="pricingLimits.balanceDaysMax"
                step="1"
                inputmode="numeric"
                :placeholder="panelContent.daysPlaceholder"
                @input="updatePayment({ balance: { ...balance, days: parseOptionalNumber(($event.target as HTMLInputElement).value) } })"
              />
            </div>
          </div>
        </div>
      </div>
      <p class="hint">
        {{ paymentHint }}
      </p>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/payment-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/components/inputs' as inputs;
@use '@/styles/components/buttons' as buttons;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-payment-panel {
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

    .checkbox-group,
    .radio-group {
      display: grid;
      gap: var(--layout-gap-xs);
    }

    .choice {
      @include buttons.checkbox-label(white);
      border: 1px solid rgba($secondary, 0.06);

      input[type='radio'] {
        @include buttons.checkbox(white);
        border-radius: borders.$rounded;
      }
    }

    .deposit-settings {
      display: flex;
      flex-direction: column;
      gap: var(--layout-gap-sm);
    }

    .range {
      width: 100%;
    }

    .row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 120px);
      gap: var(--layout-gap-xs);
      align-items: center;
    }

    .select {
      @include inputs.select($theme: base);
    }

    .input {
      @include inputs.field($theme: base);
    }

    .hint {
      margin: 0;
      @include little-text($thin: false);
      color: rgba($secondary, 0.65);
    }
  }
}
</style>
