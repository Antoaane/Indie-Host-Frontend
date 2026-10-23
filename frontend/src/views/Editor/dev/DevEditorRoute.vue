<!-- File: src/views/Editor/dev/DevEditorRoute.vue -->

<script setup lang="ts">
import { computed } from 'vue'

import Editor from '@/views/Editor/_Editor.vue'
import type { EditorSource } from '@/views/Editor/types/editor'
import { createDevEditorSource } from '@/views/Editor/dev/devEditorSource'

// Route de développement (`/dev/editor`, enregistrée seulement en `import.meta.env.DEV`) :
// l'éditeur sur des annonces en mémoire, sans compte ni API, pour travailler son interface.
const source = computed<EditorSource>(() => createDevEditorSource())
</script>

<template>
  <Editor
    mode="static"
    :source="source"
  />
</template>
