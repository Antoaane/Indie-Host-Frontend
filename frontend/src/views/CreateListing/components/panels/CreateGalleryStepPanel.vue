<!-- File: src/views/CreateListing/components/panels/CreateGalleryStepPanel.vue -->

<script setup lang="ts">
import type { RawMedias } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import GalleryPanel from '@/views/CreateListing/components/panels/ListingPanels/GalleryPanel.vue'
import CreateWizardStepShell from '@/views/CreateListing/components/panels/CreateWizardStepShell.vue'

const props = defineProps<{
  medias?: Partial<RawMedias> | null
  listingId?: string | null
  validationError?: string | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()
</script>

<template>
  <CreateWizardStepShell
    title="Ajoutez des photos qui valorisent votre logement"
    hint="Commencez par votre meilleure photo: elle sera utilisée en couverture."
    :validation-error="props.validationError"
  >
    <GalleryPanel
      :medias="props.medias"
      :listing-id="props.listingId"
      @patch="emit('patch', $event)"
    />
  </CreateWizardStepShell>
</template>
