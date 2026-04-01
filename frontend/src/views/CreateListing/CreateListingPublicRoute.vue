<!-- File: src/views/CreateListing/CreateListingPublicRoute.vue -->

<script setup lang="ts">
import { computed } from 'vue'

import CreateListing from '@/views/CreateListing/_CreateListing.vue'
import type { EditorSource } from '@/views/Editor/types/editor'
import { createStaticEditorSource } from '@/views/Editor/utils/editorSourceStatic'

const source = computed<EditorSource>(() => createStaticEditorSource())
</script>

<template>
  <CreateListing
    mode="static"
    :source="source"
  />
</template>
