<!-- File: src/views/CreateListing/components/panels/CreateBasePricingStepPanel.vue -->

<script setup lang="ts">
import type { RawBookings } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import BasePricingPanel from '@/views/CreateListing/components/panels/PricingPanels/BasePricingPanel.vue'
import CreateWizardStepShell from '@/views/CreateListing/components/panels/CreateWizardStepShell.vue'

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
    title="Définis ton prix de base et tes ajustements"
    :validation-error="props.validationError"
  >
    <BasePricingPanel
      :bookings="props.bookings"
      :show-extra-guests="false"
      @patch="emit('patch', $event)"
    />
  </CreateWizardStepShell>
</template>
