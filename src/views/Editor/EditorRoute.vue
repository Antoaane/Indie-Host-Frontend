<!-- File: src/views/Editor/EditorRoute.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import Editor from '@/views/Editor/Editor.vue'
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
  <Editor
    :mode="mode"
    :source="source"
  />
</template>

