<!-- File: src/views/CreateListing/CreateListingRoute.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import CreateListing from '@/views/CreateListing/_CreateListing.vue'
import type { EditorMode, EditorSource } from '@/views/Editor/types/editor'
import { createStaticEditorSource } from '@/views/Editor/utils/editorSourceStatic'
import { createUserEditorSource } from '@/views/Editor/utils/editorSourceUser'

const route = useRoute()

const userId = computed(() => {
  const value = route.params.userId
  if (typeof value === 'string' && value.trim()) return value.trim()
  return null
})

const mode = computed<EditorMode>(() => (userId.value ? 'user' : 'static'))

const source = computed<EditorSource>(() => {
  if (mode.value === 'static') return createStaticEditorSource()
  return createUserEditorSource(userId.value!)
})
</script>

<template>
  <div class="create-listing-route">
    <CreateListing
      :mode="mode"
      :source="source"
      :userId="userId"
    />
  </div>
</template>

<style lang="scss">
/* File: src/views/CreateListing/create-listing-route.scss */

.create-listing-route {
  display: contents;
}
</style>
