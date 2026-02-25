<!-- File: src/views/CreateListing/components/panels/CreateLocationStepPanel.vue -->

<script setup lang="ts">
import type { RawCore } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import LocationPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/LocationPanel.vue'
import CreateWizardStepShell from '@/views/CreateListing/components/panels/CreateWizardStepShell.vue'

const props = withDefaults(defineProps<{
  core?: Partial<RawCore> | null
  requirePreciseAddress?: boolean
  validationError?: string | null
}>(), {
  requirePreciseAddress: true,
})

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()
</script>

<template>
  <CreateWizardStepShell
    title="Renseigne l’adresse précise du logement"
    hint="Nous utilisons cette adresse pour préparer automatiquement la localisation affichée."
    :validation-error="props.validationError"
  >
    <LocationPanel
      :core="props.core"
      :require-precise-address="props.requirePreciseAddress"
      @patch="emit('patch', $event)"
    />
  </CreateWizardStepShell>
</template>
