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
    title="Rédige une présentation claire de ton logement"
    hint="Explique l’ambiance, les points forts et ce qui rend le séjour unique."
    :validation-error="props.validationError"
  >
    <DescriptionPanel
      :core="props.core"
      @patch="emit('patch', $event)"
    />
  </CreateWizardStepShell>
</template>
