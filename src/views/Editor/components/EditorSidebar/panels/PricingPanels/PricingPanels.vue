<!-- File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/PricingPanels.vue -->

<script setup lang="ts">
import type { RawListingBundle } from '@/views/ListingView/utils/useParseContent'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'

import BasePricingPanel from '@/views/Editor/components/EditorSidebar/panels/PricingPanels/BasePricingPanel.vue'
import StayDurationPanel from '@/views/Editor/components/EditorSidebar/panels/PricingPanels/StayDurationPanel.vue'
import FeesPanel from '@/views/Editor/components/EditorSidebar/panels/PricingPanels/FeesPanel.vue'
import TaxesPanel from '@/views/Editor/components/EditorSidebar/panels/PricingPanels/TaxesPanel.vue'
import PaymentPanel from '@/views/Editor/components/EditorSidebar/panels/PricingPanels/PaymentPanel.vue'
import DepositPanel from '@/views/Editor/components/EditorSidebar/panels/PricingPanels/DepositPanel.vue'
import CancellationPanel from '@/views/Editor/components/EditorSidebar/panels/PricingPanels/CancellationPanel.vue'
import SummaryPanel from '@/views/Editor/components/EditorSidebar/panels/PricingPanels/SummaryPanel.vue'

const props = defineProps<{
  draft: RawListingBundle
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()
</script>

<template>
  <div class="editor-pricing-panels">
    <BasePricingPanel
      :bookings="props.draft.bookings"
      @patch="emit('patch', $event)"
    />
    <StayDurationPanel
      :bookings="props.draft.bookings"
      @patch="emit('patch', $event)"
    />
    <FeesPanel
      :bookings="props.draft.bookings"
      @patch="emit('patch', $event)"
    />
    <TaxesPanel
      :bookings="props.draft.bookings"
      @patch="emit('patch', $event)"
    />
    <PaymentPanel
      :bookings="props.draft.bookings"
      @patch="emit('patch', $event)"
    />
    <DepositPanel
      :bookings="props.draft.bookings"
      @patch="emit('patch', $event)"
    />
    <CancellationPanel
      :bookings="props.draft.bookings"
      @patch="emit('patch', $event)"
    />
    <SummaryPanel
      :core="props.draft.core"
      :bookings="props.draft.bookings"
    />
  </div>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/pricing-panels.scss */

@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-pricing-panels {
  @extend %panels-stack;
}
</style>
