<!-- File: src/views/CreateListing/components/panels/PricingPanels/PricingDiscountsPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { RawBookings } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import NumberStepper from '@/components/inputs/NumberStepper.vue'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import { clampInteger, formatValidationMessage } from '@/utils/inputValidation'

type PricingDurationDiscountTier = {
  minNights?: number | null
  percent?: number | null
}

type PricingBookingWindowDiscountTier = {
  maxDaysBeforeArrival?: number | null
  percent?: number | null
}

type PricingStay = {
  weeklyDiscount?: number | null
  monthlyDiscount?: number | null
  durationDiscounts?: PricingDurationDiscountTier[]
  bookingWindowDiscounts?: PricingBookingWindowDiscountTier[]
}

type PricingSettings = {
  stay?: PricingStay
}

type NormalizedDurationDiscountTier = {
  minNights: number
  percent: number
}

type NormalizedBookingWindowDiscountTier = {
  maxDaysBeforeArrival: number
  percent: number
}

const DEFAULT_DURATION_THRESHOLDS = [
  7,
  28,
]
const DEFAULT_BOOKING_WINDOW_DAYS = 2
const DEFAULT_PERCENT = 10

const props = defineProps<{
  bookings?: Partial<RawBookings> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const pricing = computed<PricingSettings>(() => (props.bookings as any)?.pricing ?? {})
const stay = computed<PricingStay>(() => pricing.value.stay ?? {})
const pricingLimits = editorStatic.validation.pricing
const panelContent = editorStatic.panels.pricing.createDiscounts

const maxLeadTimeDays = computed(() => Math.max(1, clampInteger(pricingLimits.balanceDaysMax, 1, 3650, 365)))
const defaultPercent = computed(() => clampInteger(DEFAULT_PERCENT, Math.max(1, pricingLimits.discountMin), pricingLimits.discountMax, 5))

const durationDiscounts = computed<NormalizedDurationDiscountTier[]>(() => normalizeDurationDiscounts(stay.value.durationDiscounts, stay.value))

const bookingWindowDiscounts = computed<NormalizedBookingWindowDiscountTier[]>(() => normalizeBookingWindowDiscounts(stay.value.bookingWindowDiscounts))

const customDurationDiscounts = computed(() => durationDiscounts.value.filter((tier) => !DEFAULT_DURATION_THRESHOLDS.includes(tier.minNights)))

const customBookingWindowDiscounts = computed(() => bookingWindowDiscounts.value.filter((tier) => tier.maxDaysBeforeArrival !== DEFAULT_BOOKING_WINDOW_DAYS))

const discountsHint = computed(() =>
  formatValidationMessage(panelContent.hint, {
    discountMin: pricingLimits.discountMin,
    discountMax: pricingLimits.discountMax,
    discountTiersMax: pricingLimits.discountTiersMax,
  }),
)

function clampPercent(value: unknown, fallback = defaultPercent.value) {
  return clampInteger(value, pricingLimits.discountMin, pricingLimits.discountMax, fallback)
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
  const weekly = clampPercent(rawStay.weeklyDiscount, 0)
  const monthly = clampPercent(rawStay.monthlyDiscount, 0)

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
    const configured = input.map((entry) => normalizeDurationDiscountTier(entry)).filter((entry): entry is NormalizedDurationDiscountTier => Boolean(entry))

    if (configured.length > 0) {
      return dedupeAndSortDurationDiscounts(configured)
    }
  }

  return dedupeAndSortDurationDiscounts(legacyDurationDiscounts(rawStay ?? {}))
}

function normalizeBookingWindowDiscountTier(input: unknown): NormalizedBookingWindowDiscountTier | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null

  const raw = input as Record<string, unknown>
  const daysValue = raw.maxDaysBeforeArrival ?? raw.daysBeforeArrival ?? raw.daysBefore ?? raw.maxDays
  const percentValue = raw.percent ?? raw.discount ?? raw.discountPercent

  const maxDaysBeforeArrival = clampInteger(daysValue, 1, maxLeadTimeDays.value, DEFAULT_BOOKING_WINDOW_DAYS)
  const percent = clampPercent(percentValue)
  if (percent <= 0) return null

  return {
    maxDaysBeforeArrival,
    percent,
  }
}

function dedupeAndSortBookingWindowDiscounts(input: NormalizedBookingWindowDiscountTier[]) {
  const maxItems = Math.max(1, clampInteger(pricingLimits.discountTiersMax, 1, 50, 12))
  const byThreshold = new Map<number, NormalizedBookingWindowDiscountTier>()

  input.slice(0, maxItems).forEach((tier) => {
    const existing = byThreshold.get(tier.maxDaysBeforeArrival)
    if (!existing || tier.percent > existing.percent) {
      byThreshold.set(tier.maxDaysBeforeArrival, tier)
    }
  })

  return Array.from(byThreshold.values()).sort((a, b) => a.maxDaysBeforeArrival - b.maxDaysBeforeArrival)
}

function normalizeBookingWindowDiscounts(input: unknown): NormalizedBookingWindowDiscountTier[] {
  if (!Array.isArray(input)) return []

  const configured = input.map((entry) => normalizeBookingWindowDiscountTier(entry)).filter((entry): entry is NormalizedBookingWindowDiscountTier => Boolean(entry))

  return dedupeAndSortBookingWindowDiscounts(configured)
}

function updateStay(patch: Partial<PricingStay>) {
  const nextStay = {
    ...stay.value,
    ...patch,
  }

  const normalizedDurationDiscounts = normalizeDurationDiscounts(nextStay.durationDiscounts, nextStay)
  const normalizedBookingWindowDiscounts = normalizeBookingWindowDiscounts(nextStay.bookingWindowDiscounts)
  const weeklyDiscount = normalizedDurationDiscounts.find((tier) => tier.minNights === 7)?.percent ?? 0
  const monthlyDiscount = normalizedDurationDiscounts.find((tier) => tier.minNights === 28)?.percent ?? 0

  updatePricing({
    stay: {
      ...nextStay,
      durationDiscounts: normalizedDurationDiscounts,
      bookingWindowDiscounts: normalizedBookingWindowDiscounts,
      weeklyDiscount,
      monthlyDiscount,
    },
  })
}

function isDurationDefaultEnabled(threshold: number) {
  return durationDiscounts.value.some((tier) => tier.minNights === threshold)
}

function resolveDurationDefaultPercent(threshold: number) {
  return durationDiscounts.value.find((tier) => tier.minNights === threshold)?.percent ?? defaultPercent.value
}

function setDurationDefaultEnabled(threshold: number, enabled: boolean) {
  if (enabled) {
    updateStay({
      durationDiscounts: [
        ...durationDiscounts.value.filter((tier) => tier.minNights !== threshold),
        {
          minNights: threshold,
          percent: resolveDurationDefaultPercent(threshold),
        },
      ],
    })
    return
  }

  updateStay({
    durationDiscounts: durationDiscounts.value.filter((tier) => tier.minNights !== threshold),
  })
}

function setDurationDefaultPercent(threshold: number, value: unknown) {
  updateStay({
    durationDiscounts: [
      ...durationDiscounts.value.filter((tier) => tier.minNights !== threshold),
      {
        minNights: threshold,
        percent: clampPercent(value),
      },
    ],
  })
}

function resolveNextDurationThreshold(tiers: NormalizedDurationDiscountTier[]): number {
  const used = new Set(tiers.map((tier) => tier.minNights))
  const preferred = [
    14,
    21,
    30,
    60,
  ].find((threshold) => threshold >= pricingLimits.minNights && threshold <= pricingLimits.maxNights && !used.has(threshold) && !DEFAULT_DURATION_THRESHOLDS.includes(threshold))

  if (preferred) return preferred

  const lastThreshold = tiers[tiers.length - 1]?.minNights ?? DEFAULT_DURATION_THRESHOLDS[1]
  let next = clampInteger(lastThreshold + 1, pricingLimits.minNights, pricingLimits.maxNights, pricingLimits.minNights)
  while (DEFAULT_DURATION_THRESHOLDS.includes(next) && next < pricingLimits.maxNights) {
    next += 1
  }
  return clampInteger(next, pricingLimits.minNights, pricingLimits.maxNights, pricingLimits.minNights)
}

function addCustomDurationDiscountTier() {
  const current = durationDiscounts.value
  const maxItems = Math.max(1, clampInteger(pricingLimits.discountTiersMax, 1, 50, 12))
  if (current.length >= maxItems) return

  updateStay({
    durationDiscounts: [
      ...current,
      {
        minNights: resolveNextDurationThreshold(current),
        percent: defaultPercent.value,
      },
    ],
  })
}

function updateCustomDurationDiscountTier(currentThreshold: number, patch: Partial<NormalizedDurationDiscountTier>) {
  const current = customDurationDiscounts.value.find((tier) => tier.minNights === currentThreshold)
  if (!current) return

  const nextTier: NormalizedDurationDiscountTier = {
    minNights: Object.prototype.hasOwnProperty.call(patch, 'minNights') ? clampInteger(patch.minNights, pricingLimits.minNights, pricingLimits.maxNights, current.minNights) : current.minNights,
    percent: Object.prototype.hasOwnProperty.call(patch, 'percent') ? clampPercent(patch.percent, current.percent) : current.percent,
  }

  updateStay({
    durationDiscounts: [
      ...durationDiscounts.value.filter((tier) => tier.minNights !== currentThreshold),
      nextTier,
    ],
  })
}

function removeCustomDurationDiscountTier(threshold: number) {
  updateStay({
    durationDiscounts: durationDiscounts.value.filter((tier) => tier.minNights !== threshold),
  })
}

function stepCustomDurationThreshold(threshold: number, delta: number) {
  const current = customDurationDiscounts.value.find((tier) => tier.minNights === threshold)
  if (!current) return

  updateCustomDurationDiscountTier(threshold, {
    minNights: current.minNights + delta,
  })
}

function stepCustomDurationPercent(threshold: number, delta: number) {
  const current = customDurationDiscounts.value.find((tier) => tier.minNights === threshold)
  if (!current) return

  updateCustomDurationDiscountTier(threshold, {
    percent: current.percent + delta,
  })
}

function isBookingDefaultEnabled() {
  return bookingWindowDiscounts.value.some((tier) => tier.maxDaysBeforeArrival === DEFAULT_BOOKING_WINDOW_DAYS)
}

function resolveBookingDefaultPercent() {
  return bookingWindowDiscounts.value.find((tier) => tier.maxDaysBeforeArrival === DEFAULT_BOOKING_WINDOW_DAYS)?.percent ?? defaultPercent.value
}

function setBookingDefaultEnabled(enabled: boolean) {
  if (enabled) {
    updateStay({
      bookingWindowDiscounts: [
        ...bookingWindowDiscounts.value.filter((tier) => tier.maxDaysBeforeArrival !== DEFAULT_BOOKING_WINDOW_DAYS),
        {
          maxDaysBeforeArrival: DEFAULT_BOOKING_WINDOW_DAYS,
          percent: resolveBookingDefaultPercent(),
        },
      ],
    })
    return
  }

  updateStay({
    bookingWindowDiscounts: bookingWindowDiscounts.value.filter((tier) => tier.maxDaysBeforeArrival !== DEFAULT_BOOKING_WINDOW_DAYS),
  })
}

function setBookingDefaultPercent(value: unknown) {
  updateStay({
    bookingWindowDiscounts: [
      ...bookingWindowDiscounts.value.filter((tier) => tier.maxDaysBeforeArrival !== DEFAULT_BOOKING_WINDOW_DAYS),
      {
        maxDaysBeforeArrival: DEFAULT_BOOKING_WINDOW_DAYS,
        percent: clampPercent(value),
      },
    ],
  })
}

function resolveNextBookingWindowThreshold(tiers: NormalizedBookingWindowDiscountTier[]): number {
  const used = new Set(tiers.map((tier) => tier.maxDaysBeforeArrival))
  const preferred = [
    3,
    7,
    14,
    30,
  ].find((threshold) => threshold <= maxLeadTimeDays.value && !used.has(threshold) && threshold !== DEFAULT_BOOKING_WINDOW_DAYS)

  if (preferred) return preferred

  const lastThreshold = tiers[tiers.length - 1]?.maxDaysBeforeArrival ?? DEFAULT_BOOKING_WINDOW_DAYS
  let next = clampInteger(lastThreshold + 1, 1, maxLeadTimeDays.value, DEFAULT_BOOKING_WINDOW_DAYS)
  while (next === DEFAULT_BOOKING_WINDOW_DAYS && next < maxLeadTimeDays.value) {
    next += 1
  }
  return clampInteger(next, 1, maxLeadTimeDays.value, DEFAULT_BOOKING_WINDOW_DAYS)
}

function addCustomBookingWindowDiscountTier() {
  const current = bookingWindowDiscounts.value
  const maxItems = Math.max(1, clampInteger(pricingLimits.discountTiersMax, 1, 50, 12))
  if (current.length >= maxItems) return

  updateStay({
    bookingWindowDiscounts: [
      ...current,
      {
        maxDaysBeforeArrival: resolveNextBookingWindowThreshold(current),
        percent: defaultPercent.value,
      },
    ],
  })
}

function updateCustomBookingWindowDiscountTier(currentThreshold: number, patch: Partial<NormalizedBookingWindowDiscountTier>) {
  const current = customBookingWindowDiscounts.value.find((tier) => tier.maxDaysBeforeArrival === currentThreshold)
  if (!current) return

  const nextTier: NormalizedBookingWindowDiscountTier = {
    maxDaysBeforeArrival: Object.prototype.hasOwnProperty.call(patch, 'maxDaysBeforeArrival') ? clampInteger(patch.maxDaysBeforeArrival, 1, maxLeadTimeDays.value, current.maxDaysBeforeArrival) : current.maxDaysBeforeArrival,
    percent: Object.prototype.hasOwnProperty.call(patch, 'percent') ? clampPercent(patch.percent, current.percent) : current.percent,
  }

  updateStay({
    bookingWindowDiscounts: [
      ...bookingWindowDiscounts.value.filter((tier) => tier.maxDaysBeforeArrival !== currentThreshold),
      nextTier,
    ],
  })
}

function removeCustomBookingWindowDiscountTier(threshold: number) {
  updateStay({
    bookingWindowDiscounts: bookingWindowDiscounts.value.filter((tier) => tier.maxDaysBeforeArrival !== threshold),
  })
}

function stepCustomBookingThreshold(threshold: number, delta: number) {
  const current = customBookingWindowDiscounts.value.find((tier) => tier.maxDaysBeforeArrival === threshold)
  if (!current) return

  updateCustomBookingWindowDiscountTier(threshold, {
    maxDaysBeforeArrival: current.maxDaysBeforeArrival + delta,
  })
}

function stepCustomBookingPercent(threshold: number, delta: number) {
  const current = customBookingWindowDiscounts.value.find((tier) => tier.maxDaysBeforeArrival === threshold)
  if (!current) return

  updateCustomBookingWindowDiscountTier(threshold, {
    percent: current.percent + delta,
  })
}
</script>

<template>
  <section class="create-pricing-discounts-panel">
    <div class="header">
      <h2>{{ panelContent.title }}</h2>
      <h3>{{ panelContent.subtitle }}</h3>
    </div>

    <div class="body">
      <div class="discount-block">
        <div class="block-header">
          <h3>{{ panelContent.durationTitle }}</h3>
        </div>

        <div class="default-row">
          <label class="toggle">
            <input
              type="checkbox"
              :checked="isDurationDefaultEnabled(7)"
              @change="setDurationDefaultEnabled(7, ($event.target as HTMLInputElement).checked)"
            />
            <span>{{ panelContent.durationDefault7 }}</span>
          </label>

          <NumberStepper
            :value="resolveDurationDefaultPercent(7)"
            :min="pricingLimits.discountMin"
            :max="pricingLimits.discountMax"
            :disabled="!isDurationDefaultEnabled(7)"
            :decrement-disabled="!isDurationDefaultEnabled(7)"
            :increment-disabled="!isDurationDefaultEnabled(7)"
            :suffix="panelContent.discountSuffix"
            @decrement="setDurationDefaultPercent(7, resolveDurationDefaultPercent(7) - 1)"
            @input="setDurationDefaultPercent(7, $event.number)"
            @increment="setDurationDefaultPercent(7, resolveDurationDefaultPercent(7) + 1)"
          />
        </div>

        <div class="default-row">
          <label class="toggle">
            <input
              type="checkbox"
              :checked="isDurationDefaultEnabled(28)"
              @change="setDurationDefaultEnabled(28, ($event.target as HTMLInputElement).checked)"
            />
            <span>{{ panelContent.durationDefault28 }}</span>
          </label>

          <NumberStepper
            :value="resolveDurationDefaultPercent(28)"
            :min="pricingLimits.discountMin"
            :max="pricingLimits.discountMax"
            :disabled="!isDurationDefaultEnabled(28)"
            :decrement-disabled="!isDurationDefaultEnabled(28)"
            :increment-disabled="!isDurationDefaultEnabled(28)"
            :suffix="panelContent.discountSuffix"
            @decrement="setDurationDefaultPercent(28, resolveDurationDefaultPercent(28) - 1)"
            @input="setDurationDefaultPercent(28, $event.number)"
            @increment="setDurationDefaultPercent(28, resolveDurationDefaultPercent(28) + 1)"
          />
        </div>

        <div class="custom-actions">
          <button
            type="button"
            @click="addCustomDurationDiscountTier"
          >
            {{ panelContent.durationAdd }}
          </button>
        </div>

        <p
          v-if="!customDurationDiscounts.length"
          class="empty"
        >
          {{ panelContent.durationEmpty }}
        </p>

        <div
          v-for="tier in customDurationDiscounts"
          :key="`duration-${tier.minNights}`"
          class="custom-row"
        >
          <NumberStepper
            :value="tier.minNights"
            :min="pricingLimits.minNights"
            :max="pricingLimits.maxNights"
            :suffix="panelContent.durationThresholdSuffix"
            @decrement="stepCustomDurationThreshold(tier.minNights, -1)"
            @input="updateCustomDurationDiscountTier(tier.minNights, { minNights: $event.number })"
            @increment="stepCustomDurationThreshold(tier.minNights, 1)"
          />

          <NumberStepper
            :value="tier.percent"
            :min="pricingLimits.discountMin"
            :max="pricingLimits.discountMax"
            :suffix="panelContent.discountSuffix"
            @decrement="stepCustomDurationPercent(tier.minNights, -1)"
            @input="updateCustomDurationDiscountTier(tier.minNights, { percent: $event.number })"
            @increment="stepCustomDurationPercent(tier.minNights, 1)"
          />

          <div class="remove">
            <button
              type="button"
              @click="removeCustomDurationDiscountTier(tier.minNights)"
            >
              ✕
            </button>
          </div>
        </div>

        <p class="block-hint">
          {{ panelContent.durationSubtitle }}
        </p>
      </div>

      <div class="discount-block">
        <div class="block-header">
          <h3>{{ panelContent.bookingTitle }}</h3>
        </div>

        <div class="default-row">
          <label class="toggle">
            <input
              type="checkbox"
              :checked="isBookingDefaultEnabled()"
              @change="setBookingDefaultEnabled(($event.target as HTMLInputElement).checked)"
            />
            <span>{{ panelContent.bookingDefault48h }}</span>
          </label>

          <NumberStepper
            :value="resolveBookingDefaultPercent()"
            :min="pricingLimits.discountMin"
            :max="pricingLimits.discountMax"
            :disabled="!isBookingDefaultEnabled()"
            :decrement-disabled="!isBookingDefaultEnabled()"
            :increment-disabled="!isBookingDefaultEnabled()"
            :suffix="panelContent.discountSuffix"
            @decrement="setBookingDefaultPercent(resolveBookingDefaultPercent() - 1)"
            @input="setBookingDefaultPercent($event.number)"
            @increment="setBookingDefaultPercent(resolveBookingDefaultPercent() + 1)"
          />
        </div>

        <div class="custom-actions">
          <button
            type="button"
            @click="addCustomBookingWindowDiscountTier"
          >
            {{ panelContent.bookingAdd }}
          </button>
        </div>

        <p
          v-if="!customBookingWindowDiscounts.length"
          class="empty"
        >
          {{ panelContent.bookingEmpty }}
        </p>

        <div
          v-for="tier in customBookingWindowDiscounts"
          :key="`booking-window-${tier.maxDaysBeforeArrival}`"
          class="custom-row"
        >
          <NumberStepper
            :value="tier.maxDaysBeforeArrival"
            min="1"
            :max="maxLeadTimeDays"
            :suffix="panelContent.bookingThresholdSuffix"
            @decrement="stepCustomBookingThreshold(tier.maxDaysBeforeArrival, -1)"
            @input="updateCustomBookingWindowDiscountTier(tier.maxDaysBeforeArrival, { maxDaysBeforeArrival: $event.number })"
            @increment="stepCustomBookingThreshold(tier.maxDaysBeforeArrival, 1)"
          />

          <NumberStepper
            :value="tier.percent"
            :min="pricingLimits.discountMin"
            :max="pricingLimits.discountMax"
            :suffix="panelContent.discountSuffix"
            @decrement="stepCustomBookingPercent(tier.maxDaysBeforeArrival, -1)"
            @input="updateCustomBookingWindowDiscountTier(tier.maxDaysBeforeArrival, { percent: $event.number })"
            @increment="stepCustomBookingPercent(tier.maxDaysBeforeArrival, 1)"
          />

          <div class="remove">
            <button
              type="button"
              @click="removeCustomBookingWindowDiscountTier(tier.maxDaysBeforeArrival)"
            >
              ✕
            </button>
          </div>
        </div>

        <p class="block-hint">
          {{ panelContent.bookingSubtitle }}
        </p>
      </div>

      <p class="hint">
        {{ discountsHint }}
      </p>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/CreateListing/components/panels/PricingPanels/pricing-discounts-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/components/buttons' as buttons;
@use '@/views/CreateListing/components/panels/panel.scss' as *;

.create-pricing-discounts-panel {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;

    .discount-block {
      display: flex;
      flex-direction: column;
      gap: var(--layout-gap-sm);
      // border: 1px solid rgba($secondary, 0.06);
      // border-radius: 0.75rem;
      // padding: var(--layout-gap-sm);
    }

    .block-header {
      display: grid;
      gap: 0.25rem;

      > h3 {
        margin: 0;
        @include h4-title();
        color: rgba($secondary, 0.9);
      }
    }

    .block-hint {
      margin: 0;
      @include little-text($thin: true);
      color: rgba($secondary-text, 0.58);
    }

    .toggle {
      @include buttons.checkbox-label(white);
      border: 1px solid rgba($secondary, 0.06);
      align-self: stretch;
      min-height: 2.65rem;
    }

    .default-row,
    .custom-row {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) auto;
      gap: var(--layout-gap-xs);
      align-items: center;

      @media screen and (max-width: 900px) {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .custom-actions {
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

    .empty {
      margin: 0;
      @include little-text($thin: false);
      color: rgba($secondary, 0.6);
    }

    .remove {
      @media screen and (max-width: 900px) {
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

    .hint {
      margin: 0;
      margin-top: auto;
      @include little-text($thin: true);
      color: rgba($secondary-text, 0.58);
    }
  }
}
</style>
