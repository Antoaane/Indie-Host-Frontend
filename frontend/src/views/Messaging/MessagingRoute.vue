<!-- File: src/views/Messaging/MessagingRoute.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import MessagingView from '@/views/Messaging/MessagingView.vue'
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
  <div class="messaging-route">
    <MessagingView
      :mode="mode"
      :source="source"
    />
  </div>
</template>

<style lang="scss">
/* File: src/views/Messaging/messaging-route.scss */

.messaging-route {
  display: contents;
}
</style>
