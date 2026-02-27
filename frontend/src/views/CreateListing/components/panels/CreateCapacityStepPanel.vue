<!-- File: src/views/CreateListing/components/panels/CreateCapacityStepPanel.vue -->

<script setup lang="ts">
import type { RawCore } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import CapacityPanel from '@/views/CreateListing/components/panels/ListingPanels/CapacityPanel.vue'
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
    title="Définis la capacité maximale de ton logement"
    :validation-error="props.validationError"
  >
    <CapacityPanel
      :core="props.core"
      @patch="emit('patch', $event)"
    />
  </CreateWizardStepShell>
</template>
