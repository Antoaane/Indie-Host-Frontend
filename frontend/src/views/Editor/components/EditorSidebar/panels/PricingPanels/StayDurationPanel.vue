<!-- File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/StayDurationPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { RawBookings } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import { clampInteger, formatValidationMessage, parseOptionalInteger } from '@/utils/inputValidation'

type PricingDurationDiscountTier = {
  minNights?: number | null
  percent?: number | null
}

type PricingStay = {
  minNights?: number | null
  maxNights?: number | null
  weeklyDiscount?: number | null
  monthlyDiscount?: number | null
  durationDiscounts?: PricingDurationDiscountTier[]
}

type PricingSettings = {
  stay?: PricingStay
}

type NormalizedDurationDiscountTier = {
  minNights: number
  percent: number
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
const panelContent = editorStatic.panels.pricing.stay

const minNights = computed(() =>
  clampInteger(stay.value.minNights, pricingLimits.minNights, pricingLimits.maxNights, pricingLimits.minNights),
)
const maxNights = computed(() =>
  Number.isFinite(Number(stay.value.maxNights))
    ? clampInteger(stay.value.maxNights, pricingLimits.minNights, pricingLimits.maxNights, pricingLimits.minNights)
    : null,
)

const durationDiscounts = computed<NormalizedDurationDiscountTier[]>(() =>
  normalizeDurationDiscounts(stay.value.durationDiscounts, stay.value),
)

const stayHint = computed(() =>
  formatValidationMessage(pricingLimits.messages.stayHint, {
    minNights: pricingLimits.minNights,
    maxNights: pricingLimits.maxNights,
    discountMin: pricingLimits.discountMin,
    discountMax: pricingLimits.discountMax,
    discountTiersMax: pricingLimits.discountTiersMax,
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

function clampPercent(value: unknown) {
  return clampInteger(value, pricingLimits.discountMin, pricingLimits.discountMax, pricingLimits.discountMin)
}

function normalizeDurationDiscountTier(input: unknown): NormalizedDurationDiscountTier | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null

  const raw = input as Record<string, unknown>
  const minNightsValue = raw.minNights ?? raw.threshold ?? raw.nights
  const percentValue = raw.percent ?? raw.discount ?? raw.discountPercent

  const threshold = clampInteger(minNightsValue, pricingLimits.minNights, pricingLimits.maxNights, pricingLimits.minNights)
  const percent = clampPercent(percentValue)
  if (percent <= 0) return null

  return {
    minNights: threshold,
    percent,
  }
}

function dedupeAndSortDurationDiscounts(input: NormalizedDurationDiscountTier[]) {
  const maxItems = Math.max(1, clampInteger(pricingLimits.discountTiersMax, 1, 50, 12))
  const byThreshold = new Map<number, NormalizedDurationDiscountTier>()

  input.slice(0, maxItems).forEach((tier) => {
    const existing = byThreshold.get(tier.minNights)
    if (!existing || tier.percent > existing.percent) {
      byThreshold.set(tier.minNights, tier)
    }
  })

  return Array.from(byThreshold.values()).sort((a, b) => a.minNights - b.minNights)
}

function legacyDurationDiscounts(rawStay: PricingStay): NormalizedDurationDiscountTier[] {
  const weekly = clampPercent(rawStay.weeklyDiscount)
  const monthly = clampPercent(rawStay.monthlyDiscount)

  const tiers: NormalizedDurationDiscountTier[] = []
  if (weekly > 0) {
    tiers.push({
      minNights: 7,
      percent: weekly,
    })
  }
  if (monthly > 0) {
    tiers.push({
      minNights: 28,
      percent: monthly,
    })
  }

  return tiers
}

function normalizeDurationDiscounts(input: unknown, rawStay?: PricingStay): NormalizedDurationDiscountTier[] {
  if (Array.isArray(input)) {
    const configured = input
      .map((entry) => normalizeDurationDiscountTier(entry))
      .filter((entry): entry is NormalizedDurationDiscountTier => Boolean(entry))

    if (configured.length > 0) {
      return dedupeAndSortDurationDiscounts(configured)
    }
  }

  return dedupeAndSortDurationDiscounts(legacyDurationDiscounts(rawStay ?? {}))
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

  const normalizedDurationDiscounts = normalizeDurationDiscounts(nextStay.durationDiscounts, nextStay)
  const weeklyDiscount = normalizedDurationDiscounts.find((tier) => tier.minNights === 7)?.percent ?? 0
  const monthlyDiscount = normalizedDurationDiscounts.find((tier) => tier.minNights === 28)?.percent ?? 0

  updatePricing({
    stay: {
      ...nextStay,
      minNights: normalizedMinNights,
      maxNights: normalizedMaxNights,
      durationDiscounts: normalizedDurationDiscounts,
      weeklyDiscount,
      monthlyDiscount,
    },
  })
}

function parseOptionalNumber(raw: string): number | null {
  return parseOptionalInteger(raw, pricingLimits.minNights, pricingLimits.maxNights)
}

function stepMaxNights(delta: number) {
  const base = maxNights.value ?? minNights.value
  const next = clampInteger(base + delta, minNights.value, pricingLimits.maxNights, minNights.value)
  updateStay({ maxNights: next })
}

function resolveNextDurationDiscountThreshold(tiers: NormalizedDurationDiscountTier[]): number {
  const used = new Set(tiers.map((tier) => tier.minNights))
  const preferred = [
    7,
    28,
  ].find((threshold) => threshold >= pricingLimits.minNights && threshold <= pricingLimits.maxNights && !used.has(threshold))

  if (preferred) return preferred

  const lastThreshold = tiers[tiers.length - 1]?.minNights ?? minNights.value
  return clampInteger(lastThreshold + 1, pricingLimits.minNights, pricingLimits.maxNights, pricingLimits.minNights)
}

function addDurationDiscountTier() {
  const current = durationDiscounts.value
  const maxItems = Math.max(1, clampInteger(pricingLimits.discountTiersMax, 1, 50, 12))
  if (current.length >= maxItems) return

  const nextThreshold = resolveNextDurationDiscountThreshold(current)
  const defaultPercent = clampInteger(5, Math.max(1, pricingLimits.discountMin), pricingLimits.discountMax, 5)

  updateStay({
    durationDiscounts: [
      ...current,
      {
        minNights: nextThreshold,
        percent: defaultPercent,
      },
    ],
  })
}

function updateDurationDiscountTier(index: number, patch: Partial<NormalizedDurationDiscountTier>) {
  const current = durationDiscounts.value
  if (!current[index]) return

  const next = [
    ...current,
  ]

  const previous = next[index]
  next[index] = {
    minNights: Object.prototype.hasOwnProperty.call(patch, 'minNights')
      ? clampInteger(patch.minNights, pricingLimits.minNights, pricingLimits.maxNights, previous.minNights)
      : previous.minNights,
    percent: Object.prototype.hasOwnProperty.call(patch, 'percent')
      ? clampPercent(patch.percent)
      : previous.percent,
  }

  updateStay({ durationDiscounts: next })
}

function removeDurationDiscountTier(index: number) {
  updateStay({
    durationDiscounts: durationDiscounts.value.filter((_, currentIndex) => currentIndex !== index),
  })
}

function stepDurationThreshold(index: number, delta: number) {
  const tier = durationDiscounts.value[index]
  if (!tier) return

  updateDurationDiscountTier(index, {
    minNights: clampInteger(
      tier.minNights + delta,
      pricingLimits.minNights,
      pricingLimits.maxNights,
      pricingLimits.minNights,
    ),
  })
}

function stepDurationDiscount(index: number, delta: number) {
  const tier = durationDiscounts.value[index]
  if (!tier) return

  updateDurationDiscountTier(index, {
    percent: clampPercent(tier.percent + delta),
  })
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

      <div class="discount-tiers">
        <div class="discount-header">
          <div class="copy">
            <p>{{ panelContent.durationDiscountsTitle }}</p>
            <span>{{ panelContent.durationDiscountsSubtitle }}</span>
          </div>
          <div class="add-tier">
            <button
              type="button"
              @click="addDurationDiscountTier"
            >
              {{ panelContent.addDurationDiscount }}
            </button>
          </div>
        </div>

        <p
          v-if="!durationDiscounts.length"
          class="discount-empty"
        >
          {{ panelContent.durationDiscountsEmpty }}
        </p>

        <div
          v-for="(tier, index) in durationDiscounts"
          :key="`tier-${index}-${tier.minNights}`"
          class="discount-row"
        >
          <div class="stepper with-suffix threshold">
            <div class="btn">
              <button
                type="button"
                @click="stepDurationThreshold(index, -1)"
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
              :value="tier.minNights"
              @input="updateDurationDiscountTier(index, { minNights: ($event.target as HTMLInputElement).valueAsNumber })"
            />
            <span class="suffix">{{ panelContent.thresholdSuffix }}</span>
            <div class="btn">
              <button
                type="button"
                @click="stepDurationThreshold(index, 1)"
              >
                +
              </button>
            </div>
          </div>

          <div class="stepper with-suffix percent">
            <div class="btn">
              <button
                type="button"
                @click="stepDurationDiscount(index, -1)"
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
              :value="tier.percent"
              @input="updateDurationDiscountTier(index, { percent: ($event.target as HTMLInputElement).valueAsNumber })"
            />
            <span class="suffix">{{ panelContent.discountSuffix }}</span>
            <div class="btn">
              <button
                type="button"
                @click="stepDurationDiscount(index, 1)"
              >
                +
              </button>
            </div>
          </div>

          <div class="remove">
            <button
              type="button"
              @click="removeDurationDiscountTier(index)"
            >
              ✕
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

    .discount-tiers {
      display: flex;
      flex-direction: column;
      gap: var(--layout-gap-xs);
    }

    .discount-header {
      display: flex;
      justify-content: space-between;
      gap: var(--layout-gap-xs);
      align-items: flex-start;

      > .copy {
        display: grid;
        gap: 0.25rem;

        > p {
          margin: 0;
          @include h4-title();
          color: rgba($secondary, 0.9);
        }

        > span {
          @include little-text($thin: false);
          color: rgba($secondary, 0.65);
        }
      }

      > .add-tier {
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
    }

    .discount-empty {
      margin: 0;
      @include little-text($thin: false);
      color: rgba($secondary, 0.6);
    }

    .discount-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
      gap: var(--layout-gap-xs);
      align-items: center;

      > .remove {
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
