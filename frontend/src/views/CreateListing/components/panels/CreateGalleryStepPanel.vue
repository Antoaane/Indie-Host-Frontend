<!-- File: src/views/CreateListing/components/panels/CreateGalleryStepPanel.vue -->

<script setup lang="ts">
import type { RawMedias } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import GalleryPanel from '@/views/CreateListing/components/panels/ListingPanels/GalleryPanel.vue'
import CreateWizardStepShell from '@/views/CreateListing/components/panels/CreateWizardStepShell.vue'

const props = defineProps<{
  medias?: Partial<RawMedias> | null
  validationError?: string | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()
</script>

<template>
  <CreateWizardStepShell
    title="Ajoute des photos qui donnent envie de réserver"
    hint="Astuce: commence par une photo lumineuse de l’espace principal."
    :validation-error="props.validationError"
  >
    <GalleryPanel
      :medias="props.medias"
      @patch="emit('patch', $event)"
    />
  </CreateWizardStepShell>
</template>
