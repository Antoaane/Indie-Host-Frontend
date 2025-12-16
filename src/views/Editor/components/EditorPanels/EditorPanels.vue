<!-- File: src/views/Editor/components/EditorPanels/EditorPanels.vue -->

<script setup lang="ts">
import type { RawListingBundle } from '@/views/ListingView/utils/useParseContent'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'

import ImportPanel from '@/views/Editor/components/EditorPanels/panels/ImportPanel.vue'
import TitlePanel from '@/views/Editor/components/EditorPanels/panels/TitlePanel.vue'
import GalleryPanel from '@/views/Editor/components/EditorPanels/panels/GalleryPanel.vue'
import DescriptionPanel from '@/views/Editor/components/EditorPanels/panels/DescriptionPanel.vue'

const props = defineProps<{
  draft: RawListingBundle
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()
</script>

<template>
  <div class="editor-panels">
    <ImportPanel />
    <TitlePanel
      :core="props.draft.core"
      @patch="emit('patch', $event)"
    />
    <GalleryPanel
      :medias="props.draft.medias"
      @patch="emit('patch', $event)"
    />
    <DescriptionPanel
      :core="props.draft.core"
      @patch="emit('patch', $event)"
    />
  </div>
</template>

