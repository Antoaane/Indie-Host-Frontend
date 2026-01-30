<!-- File: src/views/Messaging/components/MessagingSidebar/MessagingSidebar.vue -->

<script setup lang="ts">
import { Search } from 'lucide-vue-next'

import type { MessagingConversation } from '@/views/Messaging/types/messaging'

const props = defineProps<{
  conversations: MessagingConversation[]
  selectedId: string | null
  searchPlaceholder: string
  labels: {
    listing: string
    reservation: string
    guests: string
    nights: string
    status: string
    host: string
    guest: string
    unread: string
    typing: string
  }
}>()

const emit = defineEmits<{
  (event: 'select', conversationId: string): void
}>()

function handleSelect(conversationId: string) {
  emit('select', conversationId)
}
</script>

<template>
  <aside class="messaging-sidebar">
    <div class="toolbar">
      <div class="search">
        <Search class="icon" />
        <input
          type="search"
          :placeholder="props.searchPlaceholder"
          aria-label="Rechercher une conversation"
        />
      </div>
    </div>

    <div class="scroll-container">
      <ul class="conversation-list">
        <li
          v-for="conversation in props.conversations"
          :key="conversation.id"
        >
          <button
            class="conversation-card"
            :class="{
              'is-active': conversation.id === props.selectedId,
              'is-unread': conversation.unreadCount > 0,
              'is-pinned': conversation.isPinned,
              [`status-${conversation.status}`]: true,
            }"
            type="button"
            @click="handleSelect(conversation.id)"
          >
            <div
              class="avatar"
              :data-tone="conversation.participants.guest.tone"
              aria-hidden="true"
            >
              <span>{{ conversation.participants.guest.initials }}</span>
            </div>

            <div class="content">
              <div class="line-top">
                <h3>{{ conversation.participants.guest.name }}</h3>
                <span class="time">{{ conversation.lastMessage.sentAtLabel }}</span>
              </div>

              <div class="line-middle">
                <span class="listing">{{ conversation.listing.title }}</span>
                <span class="status">{{ conversation.reservation.status }}</span>
              </div>

              <div class="line-bottom">
                <p>{{ conversation.lastMessage.preview }}</p>
                <span
                  v-if="conversation.unreadCount > 0"
                  class="badge"
                  :aria-label="props.labels.unread"
                >
                  {{ conversation.unreadCount }}
                </span>
              </div>
            </div>
          </button>
        </li>
      </ul>
    </div>
  </aside>
</template>

<style lang="scss">
@use '@/views/Messaging/components/MessagingSidebar/messaging-sidebar.scss';
</style>
