<!-- File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/BasePricingPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { RawBookings } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'

type PricingWeekend = {
  enabled?: boolean
  price?: number | null
}

type PricingExtraGuests = {
  price?: number | null
  threshold?: number | null
}

type PricingSettings = {
  weekend?: PricingWeekend
  extraGuests?: PricingExtraGuests
}

const props = defineProps<{
  bookings?: Partial<RawBookings> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const pricing = computed<PricingSettings>(() => ((props.bookings as any)?.pricing ?? {}))
const weekend = computed<PricingWeekend>(() => pricing.value.weekend ?? {})
const extraGuests = computed<PricingExtraGuests>(() => pricing.value.extraGuests ?? {})

const pricePerNight = computed(() => Number(props.bookings?.price ?? 0))
const weekendEnabled = computed(() => Boolean(weekend.value.enabled))
const weekendPrice = computed(() => Number(weekend.value.price ?? 0))
const extraGuestPrice = computed(() => Number(extraGuests.value.price ?? 0))
const extraGuestThreshold = computed(() => (
  Number.isFinite(Number(extraGuests.value.threshold)) ? Number(extraGuests.value.threshold) : null
))

const panelContent = editorStatic.panels.pricing.base

function setPricePerNight(next: number) {
  emit('patch', { bookings: { price: Math.max(0, next) } })
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

function updateWeekend(patch: Partial<PricingWeekend>) {
  updatePricing({
    weekend: {
      ...weekend.value,
      ...patch,
    },
  })
}

function updateExtraGuests(patch: Partial<PricingExtraGuests>) {
  updatePricing({
    extraGuests: {
      ...extraGuests.value,
      ...patch,
    },
  })
}

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}
</script>

<template>
  <section class="editor-base-pricing-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
      <div class="field">
        <div class="field-label">
          <p>{{ panelContent.pricePerNightLabel }}</p>
          <span>{{ panelContent.pricePerNightSuffix }}</span>
        </div>
        <div class="stepper">
          <div class="btn">
            <button
              type="button"
              @click="setPricePerNight(pricePerNight - 1)"
            >
              −
            </button>
          </div>
          <input
            class="value"
            type="number"
            min="0"
            :value="pricePerNight"
            @input="setPricePerNight(Number(($event.target as HTMLInputElement).value))"
          />
          <div class="btn">
            <button
              type="button"
              @click="setPricePerNight(pricePerNight + 1)"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <label class="toggle">
        <input
          type="checkbox"
          :checked="weekendEnabled"
          @change="updateWeekend({ enabled: ($event.target as HTMLInputElement).checked })"
        />
        <span>{{ panelContent.weekendToggle }}</span>
      </label>

      <div
        v-if="weekendEnabled"
        class="field"
      >
        <div class="field-label">
          <p>{{ panelContent.weekendPriceLabel }}</p>
          <span>{{ panelContent.weekendPriceSuffix }}</span>
        </div>
        <div class="stepper">
          <div class="btn">
            <button
              type="button"
              @click="updateWeekend({ price: Math.max(0, weekendPrice - 1) })"
            >
              −
            </button>
          </div>
          <input
            class="value"
            type="number"
            min="0"
            :value="weekendPrice"
            @input="updateWeekend({ price: Math.max(0, Number(($event.target as HTMLInputElement).value)) })"
          />
          <div class="btn">
            <button
              type="button"
              @click="updateWeekend({ price: weekendPrice + 1 })"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div class="field">
        <div class="field-label">
          <p>{{ panelContent.extraGuestsLabel }}</p>
          <span>{{ panelContent.extraGuestsSuffix }}</span>
        </div>
        <div class="row">
          <div class="stepper">
            <div class="btn">
              <button
                type="button"
                @click="updateExtraGuests({ price: Math.max(0, extraGuestPrice - 1) })"
              >
                −
              </button>
            </div>
            <input
              class="value"
              type="number"
              min="0"
              :value="extraGuestPrice"
              @input="updateExtraGuests({ price: Math.max(0, Number(($event.target as HTMLInputElement).value)) })"
            />
            <div class="btn">
              <button
                type="button"
                @click="updateExtraGuests({ price: extraGuestPrice + 1 })"
              >
                +
              </button>
            </div>
          </div>
          <div class="input">
            <input
              :value="extraGuestThreshold ?? ''"
              type="number"
              min="0"
              :placeholder="panelContent.extraGuestsPlaceholder"
              @input="updateExtraGuests({ threshold: parseOptionalNumber(($event.target as HTMLInputElement).value) })"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/base-pricing-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/components/inputs' as inputs;
@use '@/styles/components/buttons' as buttons;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-base-pricing-panel {
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

    .toggle {
      @include buttons.checkbox-label(white);
      border: 1px solid rgba($secondary, 0.06);
    }

    .row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: var(--layout-gap-xs);
      align-items: center;

      > .input {
        @include inputs.field($theme: base);
      }
    }
  }
}
</style>
