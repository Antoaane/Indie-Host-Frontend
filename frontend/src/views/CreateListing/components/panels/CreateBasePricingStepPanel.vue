<!-- File: src/views/CreateListing/components/panels/CreateBasePricingStepPanel.vue -->

<script setup lang="ts">
import type { RawBookings } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import BasePricingPanel from '@/views/CreateListing/components/panels/PricingPanels/BasePricingPanel.vue'
import CreateWizardStepShell from '@/views/CreateListing/components/panels/CreateWizardStepShell.vue'
import StayDurationPanel from '@/views/Editor/components/EditorSidebar/panels/PricingPanels/StayDurationPanel.vue'
import FeesPanel from '@/views/Editor/components/EditorSidebar/panels/PricingPanels/FeesPanel.vue'

const props = defineProps<{
  bookings?: Partial<RawBookings> | null
  validationError?: string | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()
</script>

<template>
  <CreateWizardStepShell
    title="Configure ta tarification"
    :validation-error="props.validationError"
  >
    <BasePricingPanel
      :bookings="props.bookings"
      :show-extra-guests="false"
      @patch="emit('patch', $event)"
    />
    <StayDurationPanel
      :bookings="props.bookings"
      @patch="emit('patch', $event)"
    />
    <FeesPanel
      :bookings="props.bookings"
      @patch="emit('patch', $event)"
    />
  </CreateWizardStepShell>
</template>
