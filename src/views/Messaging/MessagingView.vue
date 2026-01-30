<!-- File: src/views/Messaging/MessagingView.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'

import MessagingSidebar from '@/views/Messaging/components/MessagingSidebar/MessagingSidebar.vue'
import MessagingThread from '@/views/Messaging/components/MessagingThread/MessagingThread.vue'
import { messagingStatic } from '@/views/Messaging/utils/messagingContent'
import type { MessagingConversation } from '@/views/Messaging/types/messaging'

const conversations = messagingStatic.conversations as MessagingConversation[]
const selectedConversationId = ref<string | null>(conversations[0]?.id ?? null)

const selectedConversation = computed(() => (
  conversations.find((conversation) => conversation.id === selectedConversationId.value) ?? null
))

function handleSelectConversation(conversationId: string) {
  selectedConversationId.value = conversationId
}
</script>

<template>
  <main
    id="messaging-page"
    class="messaging"
  >
    <div class="layout">
      <MessagingSidebar
        :conversations="conversations"
        :selectedId="selectedConversationId"
        :searchPlaceholder="messagingStatic.searchPlaceholder"
        :labels="messagingStatic.labels"
        @select="handleSelectConversation"
      />

      <MessagingThread
        :conversation="selectedConversation"
        :labels="messagingStatic.labels"
        :composer="messagingStatic.composer"
        :emptyState="messagingStatic.emptyState"
        :conversationStates="messagingStatic.conversationStates"
        :deliveryStates="messagingStatic.deliveryStates"
      />
    </div>
  </main>
</template>

<style lang="scss">
@use '@/views/Messaging/messaging.scss';
</style>
