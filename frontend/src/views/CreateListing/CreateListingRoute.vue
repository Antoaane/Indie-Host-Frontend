<!-- File: src/views/CreateListing/CreateListingRoute.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { requireActiveUserId } from '@/router/backOfficeUser'
import CreateListing from '@/views/CreateListing/_CreateListing.vue'
import type { EditorSource } from '@/views/Editor/types/editor'
import { createUserEditorSource } from '@/views/Editor/utils/editorSourceUser'

const route = useRoute()

const userId = computed(() => requireActiveUserId(route.params.userId))

const source = computed<EditorSource>(() => createUserEditorSource(userId.value))
</script>

<template>
  <div class="create-listing-route">
    <CreateListing
      mode="user"
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
