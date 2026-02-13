<!-- File: src/views/Messaging/components/MessagingSidebar/MessagingSidebar.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search } from 'lucide-vue-next'

import type { MessagingConversation } from '@/views/Messaging/types/messaging'

const props = defineProps<{
  conversations: MessagingConversation[]
  selectedId: string | null
  searchPlaceholder: string
  searchEmptyLabel: string
  isLoading?: boolean
  error?: string | null
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

const query = ref('')

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

const filteredConversations = computed(() => {
  const normalized = normalizeSearch(query.value.trim())
  if (!normalized) return props.conversations
  return props.conversations.filter((conversation) => conversation.searchIndex.includes(normalized))
})
</script>

<template>
  <aside class="messaging-sidebar">
    <div class="toolbar">
      <div class="search">
        <Search class="icon" />
        <input
          v-model="query"
          type="search"
          :placeholder="props.searchPlaceholder"
          aria-label="Rechercher une conversation"
        />
      </div>
    </div>

    <div class="scroll-container">
      <ul class="conversation-list">
        <li
          v-for="conversation in filteredConversations"
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
                <span class="time">{{ conversation.updatedAtLabel }}</span>
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

    <div
      v-if="props.isLoading"
      class="state"
    >
      Chargement des conversations...
    </div>
    <div
      v-else-if="props.error"
      class="state"
    >
      {{ props.error }}
    </div>
    <div
      v-else-if="!filteredConversations.length"
      class="state"
    >
      {{ props.searchEmptyLabel }}
    </div>
  </aside>
</template>

<style lang="scss">
@use '@/views/Messaging/components/MessagingSidebar/messaging-sidebar.scss';
</style>
