<!-- File: src/views/CreateListing/components/panels/CreatePricingDiscountsStepPanel.vue -->

<script setup lang="ts">
import type { RawBookings } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import CreateWizardStepShell from '@/views/CreateListing/components/panels/CreateWizardStepShell.vue'
import PricingDiscountsPanel from '@/views/CreateListing/components/panels/PricingPanels/PricingDiscountsPanel.vue'

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
    title="Configurez vos paliers de réduction"
    :validation-error="props.validationError"
  >
    <PricingDiscountsPanel
      :bookings="props.bookings"
      @patch="emit('patch', $event)"
    />
  </CreateWizardStepShell>
</template>
