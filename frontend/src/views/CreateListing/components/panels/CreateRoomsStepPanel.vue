<!-- File: src/views/CreateListing/components/panels/CreateRoomsStepPanel.vue -->

<script setup lang="ts">
import type { RawCore } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import RoomsPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/RoomsPanel.vue'
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
    title="Configure les pièces et couchages disponibles"
    :validation-error="props.validationError"
  >
    <RoomsPanel
      :core="props.core"
      @patch="emit('patch', $event)"
    />
  </CreateWizardStepShell>
</template>
