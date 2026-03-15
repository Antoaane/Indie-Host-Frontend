<!-- File: src/views/CreateListing/CreateListingPublicRoute.vue -->

<script setup lang="ts">
import { computed } from 'vue'

import CreateListing from '@/views/CreateListing/_CreateListing.vue'
import type { EditorSource } from '@/views/Editor/types/editor'
import { createStaticEditorSource } from '@/views/Editor/utils/editorSourceStatic'

const source = computed<EditorSource>(() => createStaticEditorSource())
</script>

<template>
  <div class="create-listing-public-route">
    <CreateListing
      mode="static"
      :source="source"
    />
  </div>
</template>

<style lang="scss">
/* File: src/views/CreateListing/create-listing-public-route.scss */

.create-listing-public-route {
  display: contents;
}
</style>
