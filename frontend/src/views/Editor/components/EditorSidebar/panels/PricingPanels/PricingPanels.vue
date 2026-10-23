<!-- File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/PricingPanels.vue -->

<script setup lang="ts">
import type { RawListingBundle } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import EditorSection from '@/views/Editor/components/EditorSidebar/EditorSection.vue'

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
    <EditorSection section="pricingBase">
      <BasePricingPanel
        :bookings="props.draft.bookings"
        @patch="emit('patch', $event)"
      />
    </EditorSection>
    <EditorSection section="stay">
      <StayDurationPanel
        :bookings="props.draft.bookings"
        @patch="emit('patch', $event)"
      />
    </EditorSection>
    <EditorSection section="fees">
      <FeesPanel
        :bookings="props.draft.bookings"
        @patch="emit('patch', $event)"
      />
    </EditorSection>
    <EditorSection section="taxes">
      <TaxesPanel
        :bookings="props.draft.bookings"
        @patch="emit('patch', $event)"
      />
    </EditorSection>
    <EditorSection section="payment">
      <PaymentPanel
        :bookings="props.draft.bookings"
        @patch="emit('patch', $event)"
      />
    </EditorSection>
    <EditorSection section="deposit">
      <DepositPanel
        :bookings="props.draft.bookings"
        @patch="emit('patch', $event)"
      />
    </EditorSection>
    <EditorSection section="cancellation">
      <CancellationPanel
        :bookings="props.draft.bookings"
        @patch="emit('patch', $event)"
      />
    </EditorSection>
    <EditorSection section="summary">
      <SummaryPanel
        :core="props.draft.core"
        :bookings="props.draft.bookings"
      />
    </EditorSection>
  </div>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/pricing-panels.scss */

@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-pricing-panels {
  @extend %panels-stack;
}
</style>
