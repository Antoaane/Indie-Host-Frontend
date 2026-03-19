<!-- File: src/views/CreateListing/components/panels/CreateBasePricingStepPanel.vue -->

<script setup lang="ts">
import type { RawBookings } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import BasePricingPanel from '@/views/CreateListing/components/panels/PricingPanels/BasePricingPanel.vue'
import CreateFeesPanel from '@/views/CreateListing/components/panels/PricingPanels/CreateFeesPanel.vue'
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
    title="Définissez votre tarif de base et vos frais"
    :validation-error="props.validationError"
  >
    <div class="create-base-pricing-step-stack">
      <BasePricingPanel
        :bookings="props.bookings"
        :show-extra-guests="false"
        @patch="emit('patch', $event)"
      />
      <CreateFeesPanel
        :bookings="props.bookings"
        @patch="emit('patch', $event)"
      />
    </div>
  </CreateWizardStepShell>
</template>

<style lang="scss">
.create-base-pricing-step-stack {
  width: 100%;
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--layout-gap-sm);

  > * {
    min-width: 0;
  }
}
</style>
