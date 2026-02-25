<!-- File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/StayDurationPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { RawBookings } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import { clampInteger, formatValidationMessage, parseOptionalInteger } from '@/utils/inputValidation'

type PricingStay = {
  minNights?: number | null
  maxNights?: number | null
  weeklyDiscount?: number | null
  monthlyDiscount?: number | null
}

type PricingSettings = {
  stay?: PricingStay
}

const props = defineProps<{
  bookings?: Partial<RawBookings> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const pricing = computed<PricingSettings>(() => (props.bookings as any)?.pricing ?? {})
const stay = computed<PricingStay>(() => pricing.value.stay ?? {})
const pricingLimits = editorStatic.validation.pricing

const minNights = computed(() =>
  clampInteger(stay.value.minNights, pricingLimits.minNights, pricingLimits.maxNights, pricingLimits.minNights),
)
const maxNights = computed(() =>
  Number.isFinite(Number(stay.value.maxNights))
    ? clampInteger(stay.value.maxNights, pricingLimits.minNights, pricingLimits.maxNights, pricingLimits.minNights)
    : null,
)
const weeklyDiscount = computed(() =>
  clampPercent(Number(stay.value.weeklyDiscount ?? 0)),
)
const monthlyDiscount = computed(() =>
  clampPercent(Number(stay.value.monthlyDiscount ?? 0)),
)
const panelContent = editorStatic.panels.pricing.stay
const stayHint = computed(() =>
  formatValidationMessage(pricingLimits.messages.stayHint, {
    minNights: pricingLimits.minNights,
    maxNights: pricingLimits.maxNights,
    discountMin: pricingLimits.discountMin,
    discountMax: pricingLimits.discountMax,
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

function updateStay(patch: Partial<PricingStay>) {
  const nextPatch: Partial<PricingStay> = {
    ...patch,
    ...(Object.prototype.hasOwnProperty.call(patch, 'minNights')
      ? {
          minNights: clampInteger(
            patch.minNights,
            pricingLimits.minNights,
            pricingLimits.maxNights,
            pricingLimits.minNights,
          ),
        }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(patch, 'maxNights')
      ? {
          maxNights:
            patch.maxNights === null
              ? null
              : clampInteger(
                  patch.maxNights,
                  pricingLimits.minNights,
                  pricingLimits.maxNights,
                  pricingLimits.minNights,
                ),
        }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(patch, 'weeklyDiscount')
      ? { weeklyDiscount: clampPercent(Number(patch.weeklyDiscount)) }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(patch, 'monthlyDiscount')
      ? { monthlyDiscount: clampPercent(Number(patch.monthlyDiscount)) }
      : {}),
  }

  const nextStay = {
    ...stay.value,
    ...nextPatch,
  }

  const normalizedMinNights = clampInteger(
    nextStay.minNights,
    pricingLimits.minNights,
    pricingLimits.maxNights,
    pricingLimits.minNights,
  )
  const normalizedMaxNights =
    nextStay.maxNights === null || nextStay.maxNights === undefined
      ? null
      : clampInteger(nextStay.maxNights, normalizedMinNights, pricingLimits.maxNights, normalizedMinNights)

  updatePricing({
    stay: { ...nextStay, minNights: normalizedMinNights, maxNights: normalizedMaxNights },
  })
}

function clampPercent(value: number) {
  return clampInteger(value, pricingLimits.discountMin, pricingLimits.discountMax, pricingLimits.discountMin)
}

function parseOptionalNumber(raw: string): number | null {
  return parseOptionalInteger(raw, pricingLimits.minNights, pricingLimits.maxNights)
}

function stepMaxNights(delta: number) {
  const base = maxNights.value ?? minNights.value
  const next = clampInteger(base + delta, minNights.value, pricingLimits.maxNights, minNights.value)
  updateStay({ maxNights: next })
}
</script>

<template>
  <section class="editor-stay-duration-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
      <div class="field">
        <div class="field-label">
          <p>{{ panelContent.minNights }}</p>
          <span>{{ panelContent.nightsUnit }}</span>
        </div>
        <div class="stepper">
          <div class="btn">
            <button
              type="button"
              @click="updateStay({ minNights: Math.max(pricingLimits.minNights, minNights - 1) })"
            >
              −
            </button>
          </div>
          <input
            class="value"
            type="number"
            :min="pricingLimits.minNights"
            :max="pricingLimits.maxNights"
            step="1"
            inputmode="numeric"
            :value="minNights"
            @input="updateStay({ minNights: ($event.target as HTMLInputElement).valueAsNumber })"
          />
          <div class="btn">
            <button
              type="button"
              @click="updateStay({ minNights: minNights + 1 })"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div class="field">
        <div class="field-label">
          <p>{{ panelContent.maxNights }}</p>
          <span>{{ panelContent.nightsUnit }}</span>
        </div>
        <div class="stepper">
          <div class="btn">
            <button
              type="button"
              @click="stepMaxNights(-1)"
            >
              −
            </button>
          </div>
          <input
            class="value"
            type="number"
            :min="minNights"
            :max="pricingLimits.maxNights"
            step="1"
            inputmode="numeric"
            :value="maxNights ?? ''"
            :placeholder="panelContent.maxPlaceholder"
            @input="updateStay({ maxNights: parseOptionalNumber(($event.target as HTMLInputElement).value) })"
          />
          <div class="btn">
            <button
              type="button"
              @click="stepMaxNights(1)"
            >
              +
            </button>
          </div>
        </div>
      </div>

        <div class="field">
          <div class="field-label">
            <p>{{ panelContent.weeklyDiscount }}</p>
          </div>
        <div class="stepper with-suffix">
          <div class="btn">
            <button
              type="button"
              @click="updateStay({ weeklyDiscount: clampPercent(weeklyDiscount - 1) })"
            >
              −
            </button>
          </div>
          <input
            class="value"
            type="number"
            :min="pricingLimits.discountMin"
            :max="pricingLimits.discountMax"
            step="1"
            inputmode="numeric"
            :value="weeklyDiscount"
            @input="updateStay({ weeklyDiscount: ($event.target as HTMLInputElement).valueAsNumber })"
          />
            <span class="suffix">{{ panelContent.weeklySuffix }}</span>
          <div class="btn">
            <button
              type="button"
              @click="updateStay({ weeklyDiscount: clampPercent(weeklyDiscount + 1) })"
            >
              +
            </button>
          </div>
        </div>
      </div>

        <div class="field">
          <div class="field-label">
            <p>{{ panelContent.monthlyDiscount }}</p>
          </div>
        <div class="stepper with-suffix">
          <div class="btn">
            <button
              type="button"
              @click="updateStay({ monthlyDiscount: clampPercent(monthlyDiscount - 1) })"
            >
              −
            </button>
          </div>
          <input
            class="value"
            type="number"
            :min="pricingLimits.discountMin"
            :max="pricingLimits.discountMax"
            step="1"
            inputmode="numeric"
            :value="monthlyDiscount"
            @input="updateStay({ monthlyDiscount: ($event.target as HTMLInputElement).valueAsNumber })"
          />
            <span class="suffix">{{ panelContent.monthlySuffix }}</span>
          <div class="btn">
            <button
              type="button"
              @click="updateStay({ monthlyDiscount: clampPercent(monthlyDiscount + 1) })"
            >
              +
            </button>
          </div>
        </div>
      </div>
      <p class="hint">
        {{ stayHint }}
      </p>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/stay-duration-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/components/inputs' as inputs;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-stay-duration-panel {
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

    .hint {
      margin: 0;
      @include little-text($thin: false);
      color: rgba($secondary, 0.65);
    }
  }
}
</style>
