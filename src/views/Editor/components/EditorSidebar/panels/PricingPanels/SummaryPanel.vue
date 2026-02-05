<!-- File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/SummaryPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { RawBookings, RawCore } from '@/domain/listings/types'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import { formatICUMessage } from '@/utils/i18n'

type PricingExtraGuests = {
  price?: number | null
  threshold?: number | null
}

type PricingStay = {
  minNights?: number | null
}

type PricingTaxes = {
  enabled?: boolean
  mode?: 'per-person-night' | 'per-night'
  amount?: number | null
  display?: 'included' | 'added'
}

type PricingSettings = {
  extraGuests?: PricingExtraGuests
  stay?: PricingStay
  taxes?: PricingTaxes
}

const props = defineProps<{
  core?: Partial<RawCore> | null
  bookings?: Partial<RawBookings> | null
}>()

const pricing = computed<PricingSettings>(() => ((props.bookings as any)?.pricing ?? {}))
const stay = computed(() => pricing.value.stay ?? {})
const extraGuests = computed(() => pricing.value.extraGuests ?? {})
const taxes = computed(() => pricing.value.taxes ?? {})

const nights = computed(() => Math.max(1, Number(stay.value.minNights ?? 1)))
const guests = computed(() => {
  const capacity = Number(props.core?.guest_capacity ?? 0)
  return capacity > 0 ? capacity : 2
})
const pricePerNight = computed(() => Math.max(0, Number(props.bookings?.price ?? 0)))
const extraGuestPrice = computed(() => Math.max(0, Number(extraGuests.value.price ?? 0)))
const extraGuestThreshold = computed(() => (
  Number.isFinite(Number(extraGuests.value.threshold)) ? Number(extraGuests.value.threshold) : guests.value
))

const extraGuestsCount = computed(() => Math.max(0, guests.value - extraGuestThreshold.value))
const extraGuestsTotal = computed(() => extraGuestsCount.value * extraGuestPrice.value * nights.value)

const feesTotal = computed(() => {
  const list = props.bookings?.fees ?? []
  return list.reduce((acc, fee) => {
    const value = Number((fee as any)?.amount ?? 0)
    return acc + (Number.isFinite(value) ? value : 0)
  }, 0)
})

const taxEnabled = computed(() => Boolean(taxes.value.enabled))
const taxAmount = computed(() => Math.max(0, Number(taxes.value.amount ?? 0)))
const taxMode = computed(() => taxes.value.mode ?? 'per-person-night')
const taxDisplay = computed(() => taxes.value.display ?? 'included')

const taxTotal = computed(() => {
  if (!taxEnabled.value || taxAmount.value <= 0) return 0
  if (taxMode.value === 'per-night') return taxAmount.value * nights.value
  return taxAmount.value * nights.value * guests.value
})

const total = computed(() => {
  const base = pricePerNight.value * nights.value
  const fees = feesTotal.value
  const extras = extraGuestsTotal.value
  const taxesIncluded = taxDisplay.value === 'included' ? taxTotal.value : 0
  return base + fees + extras + taxesIncluded
})

const panelContent = editorStatic.panels.pricing.summary

const feesLabel = computed(() => {
  if (feesTotal.value <= 0) return panelContent.feesNone
  return panelContent.feesLabel.replace('{amount}', feesTotal.value.toFixed(0))
})

const taxLabel = computed(() => {
  if (!taxEnabled.value || taxAmount.value <= 0) return panelContent.taxNone
  const suffix = taxDisplay.value === 'included' ? panelContent.taxIncluded : panelContent.taxAdded
  return panelContent.taxLabel
    .replace('{amount}', taxTotal.value.toFixed(0))
    .replace('{suffix}', suffix)
})

const pricePerNightLabel = computed(() => (
  panelContent.pricePerNight.replace('{price}', pricePerNight.value.toFixed(0))
))

const totalLabel = computed(() => {
  const nightsLabel = formatICUMessage(panelContent.nightsLabel, { count: nights.value })
  const guestsLabel = formatICUMessage(panelContent.guestsLabel, { count: guests.value })
  return panelContent.total
    .replace('{nights}', String(nights.value))
    .replace('{nightsLabel}', nightsLabel)
    .replace('{guests}', String(guests.value))
    .replace('{guestsLabel}', guestsLabel)
    .replace('{total}', total.value.toFixed(0))
})
</script>

<template>
  <section class="editor-summary-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
      <div class="summary">
        <p>{{ pricePerNightLabel }}</p>
        <p>{{ totalLabel }}</p>
        <p>{{ feesLabel }}</p>
        <p>{{ taxLabel }}</p>
        <p class="message">{{ panelContent.message }}</p>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/summary-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-summary-panel {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;

    .summary {
      display: grid;
      gap: var(--layout-gap-xs);

      > p {
        margin: 0;
        font-size: 0.95rem;
        color: rgba($secondary, 0.85);
      }

      > .message {
        font-weight: 600;
        color: $secondary;
      }
    }
  }
}
</style>
