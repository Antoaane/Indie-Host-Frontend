<!-- File: src/views/Management/dev/DevManagementRoute.vue -->

<script setup lang="ts">
import { computed } from 'vue'

import Management from '@/views/Management/_Management.vue'
import type { EditorSource } from '@/views/Editor/types/editor'
import { createDevEditorSource } from '@/views/Editor/dev/devEditorSource'

// Route de développement (`/dev/management`, enregistrée seulement en `import.meta.env.DEV`) :
// l'écran « Réservations » sur les annonces en mémoire de `/dev/editor`, sans compte ni API. Elles
// contiennent une page principale, une vraie réservation et des dates venues d'un calendrier
// importé : de quoi vérifier que seules les vraies réservations ont une fiche et des paiements.
const source = computed<EditorSource>(() => createDevEditorSource())
</script>

<template>
  <Management
    mode="static"
    :source="source"
  />
</template>
