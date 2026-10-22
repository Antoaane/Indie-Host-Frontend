<!-- File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/CancellationPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import NumberStepper from '@/components/inputs/NumberStepper.vue'
import type { RawBookings } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import { clampInteger, formatValidationMessage, parseOptionalInteger } from '@/utils/inputValidation'

type CancellationPolicy = 'flexible' | 'moderate' | 'strict' | 'custom'
type CancellationPresetPolicy = Exclude<CancellationPolicy, 'custom'>
type CancellationSeverity = 'low' | 'medium' | 'high'

type CancellationCustom = {
  days?: number | null
  feePercent?: number | null
}

type PricingCancellation = {
  policy?: CancellationPolicy
  refundsEnabled?: boolean
  custom?: CancellationCustom
}

type PricingSettings = {
  cancellation?: PricingCancellation
}

const props = defineProps<{
  bookings?: Partial<RawBookings> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const pricing = computed<PricingSettings>(() => (props.bookings as any)?.pricing ?? {})
const cancellation = computed<PricingCancellation>(() => pricing.value.cancellation ?? {})
const custom = computed<CancellationCustom>(() => cancellation.value.custom ?? {})
const pricingLimits = editorStatic.validation.pricing

const policy = computed<CancellationPolicy>(() => cancellation.value.policy ?? 'flexible')
// Désactivé par défaut : le voyageur n'est remboursé que si l'hôte l'autorise.
const refundsEnabled = computed(() => cancellation.value.refundsEnabled === true)
const customDays = computed(() => (Number.isFinite(Number(custom.value.days)) ? clampInteger(custom.value.days, pricingLimits.cancellationDaysMin, pricingLimits.cancellationDaysMax, pricingLimits.cancellationDaysMin) : null))
const customFee = computed(() => (Number.isFinite(Number(custom.value.feePercent)) ? clampPercent(Number(custom.value.feePercent)) : null))
const panelContent = editorStatic.panels.pricing.cancellation
const cancellationHint = computed(() =>
  formatValidationMessage(pricingLimits.messages.cancellationHint, {
    cancellationDaysMin: pricingLimits.cancellationDaysMin,
    cancellationDaysMax: pricingLimits.cancellationDaysMax,
    discountMin: pricingLimits.discountMin,
    discountMax: pricingLimits.discountMax,
  }),
)

const POLICY_PRESETS: Record<
  CancellationPresetPolicy,
  {
    severity: CancellationSeverity
    days: number
    feePercent: number
  }
> = {
  flexible: {
    severity: 'low',
    days: 3,
    feePercent: 10,
  },
  moderate: {
    severity: 'medium',
    days: 7,
    feePercent: 20,
  },
  strict: {
    severity: 'high',
    days: 14,
    feePercent: 35,
  },
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

function updateCancellation(patch: Partial<PricingCancellation>) {
  updatePricing({
    cancellation: {
      ...cancellation.value,
      ...patch,
    },
  })
}

function updateCustom(patch: Partial<CancellationCustom>) {
  const nextPatch = {
    ...patch,
    ...(Object.prototype.hasOwnProperty.call(patch, 'days')
      ? {
          days: patch.days === null ? null : clampInteger(patch.days, pricingLimits.cancellationDaysMin, pricingLimits.cancellationDaysMax, pricingLimits.cancellationDaysMin),
        }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(patch, 'feePercent') ? { feePercent: clampPercent(Number(patch.feePercent)) } : {}),
  }

  updateCancellation({
    custom: {
      ...custom.value,
      ...nextPatch,
    },
  })
}

function clampPercent(value: number) {
  return clampInteger(value, pricingLimits.discountMin, pricingLimits.discountMax, pricingLimits.discountMin)
}

function resolveLateFeePercent(feePercent: number) {
  return clampPercent(feePercent + 20)
}

function getPolicyRules(policyKey: CancellationPresetPolicy, values?: Partial<CancellationCustom>) {
  const defaults = POLICY_PRESETS[policyKey]
  const days = Number.isFinite(Number(values?.days)) ? Math.max(pricingLimits.cancellationDaysMin, Number(values?.days)) : defaults.days
  const feePercent = Number.isFinite(Number(values?.feePercent)) ? clampPercent(Number(values?.feePercent)) : defaults.feePercent
  const lateFeePercent = resolveLateFeePercent(feePercent)

  return [
    panelContent.rules.fullRefund.replace('{days}', String(days)),
    panelContent.rules.partialRefund.replace('{days}', String(days)).replace('{feePercent}', String(feePercent)),
    panelContent.rules.lateCancellation.replace('{lateFeePercent}', String(lateFeePercent)),
  ]
}

const customRules = computed(() =>
  getPolicyRules('moderate', {
    days: customDays.value ?? pricingLimits.cancellationDaysMin,
    feePercent: customFee.value ?? pricingLimits.discountMin,
  }),
)

const selectedPolicyDetails = computed<{
  key: CancellationPolicy
  label: string
  severityLabel: string | null
  rules: string[]
}>(() => {
  if (policy.value === 'custom') {
    return {
      key: 'custom',
      label: panelContent.policies.custom,
      severityLabel: null,
      rules: customRules.value,
    }
  }

  const selectedPolicy = policy.value as CancellationPresetPolicy
  const preset = POLICY_PRESETS[selectedPolicy]

  return {
    key: selectedPolicy,
    label: panelContent.policies[selectedPolicy],
    severityLabel: panelContent.severities[preset.severity],
    rules: getPolicyRules(selectedPolicy),
  }
})

function onPolicyChange(nextPolicy: CancellationPolicy) {
  if (nextPolicy === 'custom') {
    updateCancellation({ policy: nextPolicy })
    return
  }

  const preset = POLICY_PRESETS[nextPolicy]
  updateCancellation({
    policy: nextPolicy,
    custom: {
      ...custom.value,
      days: preset.days,
      feePercent: preset.feePercent,
    },
  })
}

function parseOptionalNumber(raw: string): number | null {
  return parseOptionalInteger(raw, pricingLimits.cancellationDaysMin, pricingLimits.cancellationDaysMax)
}
</script>

<template>
  <section class="editor-cancellation-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
      <label class="toggle">
        <input
          type="checkbox"
          :checked="refundsEnabled"
          @change="updateCancellation({ refundsEnabled: ($event.target as HTMLInputElement).checked })"
        />
        <span>{{ panelContent.refundsEnabled }}</span>
      </label>
      <p class="hint">
        {{ refundsEnabled ? panelContent.refundsEnabledHint : panelContent.refundsDisabledHint }}
      </p>

      <div
        v-if="refundsEnabled"
        class="field"
      >
        <div class="field-label">
          <p>{{ panelContent.policyLabel }}</p>
        </div>
        <div class="select">
          <select
            :value="policy"
            @change="onPolicyChange(($event.target as HTMLSelectElement).value as CancellationPolicy)"
          >
            <option value="flexible">{{ panelContent.policies.flexible }}</option>
            <option value="moderate">{{ panelContent.policies.moderate }}</option>
            <option value="strict">{{ panelContent.policies.strict }}</option>
            <option value="custom">{{ panelContent.policies.custom }}</option>
          </select>
        </div>
      </div>

      <div
        v-if="refundsEnabled"
        class="field"
      >
        <div class="field-label">
          <p>{{ panelContent.severityRulesLabel }}</p>
        </div>
        <div class="severity-rules">
          <article
            :key="selectedPolicyDetails.key"
            :class="{
              'rule-card': true,
              'is-active': true,
            }"
          >
            <div class="rule-head">
              <p>{{ selectedPolicyDetails.label }}</p>
              <span v-if="selectedPolicyDetails.severityLabel">{{ panelContent.severityLabel }}: {{ selectedPolicyDetails.severityLabel }}</span>
            </div>
            <ul>
              <li
                v-for="rule in selectedPolicyDetails.rules"
                :key="`${selectedPolicyDetails.key}-${rule}`"
              >
                {{ rule }}
              </li>
            </ul>
          </article>
        </div>
      </div>

      <div
        v-if="refundsEnabled && policy === 'custom'"
        class="custom-settings"
      >
        <div class="field">
          <div class="field-label">
            <p>{{ panelContent.daysBefore }}</p>
          </div>
          <NumberStepper
            :value="customDays ?? ''"
            :min="pricingLimits.cancellationDaysMin"
            :max="pricingLimits.cancellationDaysMax"
            @decrement="updateCustom({ days: Math.max(pricingLimits.cancellationDaysMin, Number(customDays ?? 0) - 1) })"
            @input="updateCustom({ days: parseOptionalNumber($event.raw) })"
            @increment="updateCustom({ days: Number(customDays ?? 0) + 1 })"
          />
        </div>

        <div class="field">
          <div class="field-label">
            <p>{{ panelContent.feePercent }}</p>
          </div>
          <NumberStepper
            :value="customFee ?? ''"
            :min="pricingLimits.discountMin"
            :max="pricingLimits.discountMax"
            @decrement="updateCustom({ feePercent: clampPercent(Number(customFee ?? 0) - 1) })"
            @input="updateCustom({ feePercent: clampPercent(Number($event.raw)) })"
            @increment="updateCustom({ feePercent: clampPercent(Number(customFee ?? 0) + 1) })"
          />
        </div>

        <div class="custom-preview">
          <p>{{ panelContent.customRulesTitle }}</p>
          <ul>
            <li
              v-for="rule in customRules"
              :key="`custom-${rule}`"
            >
              {{ rule }}
            </li>
          </ul>
        </div>
      </div>
      <p
        v-if="refundsEnabled"
        class="hint"
      >
        {{ cancellationHint }}
      </p>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/cancellation-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/animations' as animations;
@use '@/styles/components/inputs' as inputs;
@use '@/styles/components/buttons' as buttons;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-cancellation-panel {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;

    // Même interrupteur que le panneau Taxes.
    .toggle {
      @include buttons.checkbox-label(white);
      border: 1px solid rgba($secondary, 0.06);
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

    .custom-settings {
      display: grid;
      gap: var(--layout-gap-xs);
    }

    .severity-rules {
      display: grid;
      gap: var(--layout-gap-xs);
    }

    .rule-card {
      display: grid;
      gap: var(--layout-gap-xs);
      padding: var(--layout-gap-xs);
      border-radius: borders.$rounded-md;
      border: 1px solid rgba($secondary, 0.12);
      background: rgba($secondary, 0.015);
      @include animations.transition(animations.$duration-base, animations.$ease-out, (border-color, background-color));

      &.is-active {
        border-color: rgba($accent, 0.55);
        background: rgba($accent, 0.08);
      }

      > ul {
        margin: 0;
        padding-left: 1.15rem;
        display: grid;
        gap: 0.3rem;

        > li {
          @include little-text($thin: false);
          margin: 0;
        }
      }
    }

    .rule-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--layout-gap-xs);

      > p {
        margin: 0;
        font-weight: 700 !important;
      }

      > span {
        @include little-text($thin: false);
        color: rgba($secondary, 0.65);
      }
    }

    .custom-preview {
      padding: var(--layout-gap-xs);
      border-radius: borders.$rounded-md;
      border: 1px dashed rgba($secondary, 0.24);
      background: rgba($secondary, 0.015);

      > p {
        margin: 0 0 var(--layout-gap-xs) 0;
        font-weight: 700 !important;
      }

      > ul {
        margin: 0;
        padding-left: 1.15rem;
        display: grid;
        gap: 0.3rem;

        > li {
          @include little-text($thin: false);
          margin: 0;
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
