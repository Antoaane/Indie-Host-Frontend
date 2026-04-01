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
  <Management
    mode="user"
    :source="source"
  />
</template>
