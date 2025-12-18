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
      class="editor-preview__content"
    >
      <ListingView :rawListing="props.rawListing" />
    </div>

    <div
      v-else
      class="editor-preview__empty"
    >
      <div class="skeleton">
        {{ props.isLoading ? 'Chargement…' : 'Sélectionne une annonce pour afficher la preview.' }}
      </div>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Editor/components/EditorPreview/editor-preview.scss';
</style>
