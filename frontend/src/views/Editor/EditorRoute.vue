<!-- File: src/views/Editor/EditorRoute.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { requireActiveUserId } from '@/router/backOfficeUser'
import Editor from '@/views/Editor/_Editor.vue'
import type { EditorSource } from '@/views/Editor/types/editor'
import { createUserEditorSource } from '@/views/Editor/utils/editorSourceUser'

const route = useRoute()

const userId = computed(() => requireActiveUserId(route.params.userId))

const source = computed<EditorSource>(() => createUserEditorSource(userId.value))
</script>

<template>
  <div class="editor-route">
    <Editor
      mode="user"
      :source="source"
    />
  </div>
</template>

<style lang="scss">
/* File: src/views/Editor/editor-route.scss */

.editor-route {
  display: contents;
}
</style>
