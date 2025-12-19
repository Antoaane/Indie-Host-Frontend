<!-- File: src/views/Editor/components/EditorPreview/EditorPreview.vue -->

<script setup lang="ts">
import ListingView from '@/views/ListingView/ListingView.vue'
import type { RawListingBundle } from '@/views/ListingView/utils/useParseContent'

const props = defineProps<{
  rawListing: RawListingBundle | null
  isLoading?: boolean
}>()
</script>

<template>
  <section class="editor-preview">
    <div
      v-if="props.rawListing"
      class="content"
    >
      <ListingView :rawListing="props.rawListing" />
    </div>

    <div
      v-else
      class="empty"
    >
      <div class="skeleton">
        {{ props.isLoading ? 'Chargement…' : 'Sélectionne une annonce pour afficher la preview.' }}
      </div>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorPreview/editor-preview.scss */

@use '@/styles/variables/globals' as *;

.editor-preview {
  height: 100%;
  min-height: 0;

  > .content {
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  > .empty {
    height: 100%;
    display: grid;
    place-items: center;
    padding: var(--layout-gap-md);
    color: rgba($secondary, 0.7);
  }
}
</style>
