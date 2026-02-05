<!-- File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/CancellationPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { RawBookings } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'

type CancellationPolicy = 'flexible' | 'moderate' | 'strict' | 'custom'

type CancellationCustom = {
  days?: number | null
  feePercent?: number | null
}

type PricingCancellation = {
  policy?: CancellationPolicy
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

const pricing = computed<PricingSettings>(() => ((props.bookings as any)?.pricing ?? {}))
const cancellation = computed<PricingCancellation>(() => pricing.value.cancellation ?? {})
const custom = computed<CancellationCustom>(() => cancellation.value.custom ?? {})

const policy = computed<CancellationPolicy>(() => cancellation.value.policy ?? 'flexible')
const customDays = computed(() => (
  Number.isFinite(Number(custom.value.days)) ? Number(custom.value.days) : null
))
const customFee = computed(() => (
  Number.isFinite(Number(custom.value.feePercent)) ? Number(custom.value.feePercent) : null
))
const panelContent = editorStatic.panels.pricing.cancellation

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
  updateCancellation({
    custom: {
      ...custom.value,
      ...patch,
    },
  })
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value))
}

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}
</script>

<template>
  <section class="editor-cancellation-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
      <div class="field">
        <div class="field-label">
          <p>{{ panelContent.policyLabel }}</p>
        </div>
        <div class="select">
          <select
            :value="policy"
            @change="updateCancellation({ policy: ($event.target as HTMLSelectElement).value as CancellationPolicy })"
          >
            <option value="flexible">{{ panelContent.policies.flexible }}</option>
            <option value="moderate">{{ panelContent.policies.moderate }}</option>
            <option value="strict">{{ panelContent.policies.strict }}</option>
            <option value="custom">{{ panelContent.policies.custom }}</option>
          </select>
        </div>
      </div>

      <div
        v-if="policy === 'custom'"
        class="custom-settings"
      >
        <div class="field">
          <div class="field-label">
            <p>{{ panelContent.daysBefore }}</p>
          </div>
          <div class="stepper">
            <div class="btn">
              <button
                type="button"
                @click="updateCustom({ days: Math.max(0, Number(customDays ?? 0) - 1) })"
              >
                −
              </button>
            </div>
            <input
              class="value"
              type="number"
              min="0"
              :value="customDays ?? ''"
              @input="updateCustom({ days: parseOptionalNumber(($event.target as HTMLInputElement).value) })"
            />
            <div class="btn">
              <button
                type="button"
                @click="updateCustom({ days: Number(customDays ?? 0) + 1 })"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div class="field">
          <div class="field-label">
            <p>{{ panelContent.feePercent }}</p>
          </div>
          <div class="stepper">
            <div class="btn">
              <button
                type="button"
                @click="updateCustom({ feePercent: clampPercent(Number(customFee ?? 0) - 1) })"
              >
                −
              </button>
            </div>
            <input
              class="value"
              type="number"
              min="0"
              max="100"
              :value="customFee ?? ''"
              @input="updateCustom({ feePercent: clampPercent(Number(($event.target as HTMLInputElement).value)) })"
            />
            <div class="btn">
              <button
                type="button"
                @click="updateCustom({ feePercent: clampPercent(Number(customFee ?? 0) + 1) })"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/cancellation-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/components/inputs' as inputs;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-cancellation-panel {
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

    .select {
      @include inputs.select($theme: base);
    }

    .stepper {
      @include inputs.stepper($theme: base);
    }

    .custom-settings {
      display: grid;
      gap: var(--layout-gap-xs);
    }
  }
}
</style>
