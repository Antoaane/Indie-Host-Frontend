<!-- File: src/views/Messaging/MessagingRoute.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { requireActiveUserId } from '@/router/backOfficeUser'
import MessagingView from '@/views/Messaging/MessagingView.vue'
import type { EditorSource } from '@/views/Editor/types/editor'
import { createUserEditorSource } from '@/views/Editor/utils/editorSourceUser'

const route = useRoute()

const userId = computed(() => requireActiveUserId(route.params.userId))

const source = computed<EditorSource>(() => createUserEditorSource(userId.value))
</script>

<template>
  <div class="messaging-route">
    <MessagingView
      mode="user"
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
