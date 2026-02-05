<!-- File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/StayDurationPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { RawBookings } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'

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

const minNights = computed(() => Math.max(1, Number(stay.value.minNights ?? 1)))
const maxNights = computed(() => (Number.isFinite(Number(stay.value.maxNights)) ? Number(stay.value.maxNights) : null))
const weeklyDiscount = computed(() => Number(stay.value.weeklyDiscount ?? 0))
const monthlyDiscount = computed(() => Number(stay.value.monthlyDiscount ?? 0))
const panelContent = editorStatic.panels.pricing.stay

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
  updatePricing({
    stay: {
      ...stay.value,
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

function stepMaxNights(delta: number) {
  const base = maxNights.value ?? minNights.value
  const next = Math.max(1, base + delta)
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
              @click="updateStay({ minNights: Math.max(1, minNights - 1) })"
            >
              −
            </button>
          </div>
          <input
            class="value"
            type="number"
            min="1"
            :value="minNights"
            @input="updateStay({ minNights: Math.max(1, Number(($event.target as HTMLInputElement).value)) })"
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
            min="1"
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
            min="0"
            max="100"
            :value="weeklyDiscount"
            @input="updateStay({ weeklyDiscount: clampPercent(Number(($event.target as HTMLInputElement).value)) })"
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
            min="0"
            max="100"
            :value="monthlyDiscount"
            @input="updateStay({ monthlyDiscount: clampPercent(Number(($event.target as HTMLInputElement).value)) })"
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
  }
}
</style>
