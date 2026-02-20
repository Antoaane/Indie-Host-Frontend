<!-- File: src/views/CreateListing/components/panels/CreateAmenitiesStepPanel.vue -->

<script setup lang="ts">
import type { RawCore } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import AmenitiesPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/AmenitiesPanel.vue'
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
    title="Sélectionne les équipements à proposer aux voyageurs"
    :validation-error="props.validationError"
  >
    <AmenitiesPanel
      :core="props.core"
      @patch="emit('patch', $event)"
    />
  </CreateWizardStepShell>
</template>
