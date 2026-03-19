<!-- File: src/views/Management/ManagementRoute.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { requireActiveUserId } from '@/router/backOfficeUser'
import Management from '@/views/Management/_Management.vue'
import type { EditorSource } from '@/views/Editor/types/editor'
import { createUserEditorSource } from '@/views/Editor/utils/editorSourceUser'

const route = useRoute()

const userId = computed(() => requireActiveUserId(route.params.userId))

const source = computed<EditorSource>(() => createUserEditorSource(userId.value))
</script>

<template>
  <div class="management-route">
    <Management
      mode="user"
      :source="source"
    />
  </div>
</template>

<style lang="scss">
/* File: src/views/Management/management-route.scss */

.management-route {
  display: contents;
}
</style>
