<!-- File: src/views/CreateListing/components/panels/CreateDescriptionStepPanel.vue -->

<script setup lang="ts">
import type { RawCore } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import DescriptionPanel from '@/views/CreateListing/components/panels/ListingPanels/DescriptionPanel.vue'
import CreateWizardStepShell from '@/views/CreateListing/components/panels/CreateWizardStepShell.vue'

const props = defineProps<{
  core?: Partial<RawCore> | null
  validationError?: string | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()
</script>

<template>
  <CreateWizardStepShell
    title="Rédigez une description utile et convaincante"
    hint="Parlez de l’ambiance, des points forts et des informations pratiques pour le séjour."
    :validation-error="props.validationError"
  >
    <DescriptionPanel
      :core="props.core"
      @patch="emit('patch', $event)"
    />
  </CreateWizardStepShell>
</template>
