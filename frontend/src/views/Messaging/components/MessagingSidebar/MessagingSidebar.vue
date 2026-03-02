<!-- File: src/views/Messaging/components/MessagingSidebar/MessagingSidebar.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search } from 'lucide-vue-next'

import BaseSidebar from '@/components/layouts/BaseSidebar.vue'
import { normalizeSearchText } from '@/utils/search'
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

const filteredConversations = computed(() => {
  const normalized = normalizeSearchText(query.value)
  if (!normalized) return props.conversations
  return props.conversations.filter((conversation) => conversation.searchIndex.includes(normalized))
})
</script>

<template>
  <BaseSidebar class="messaging-sidebar">
    <div class="scroll-container">
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

    <template
      v-if="props.isLoading || props.error || !filteredConversations.length"
      #footer
    >
      <div class="state">
        <template v-if="props.isLoading"> Chargement des conversations... </template>
        <template v-else-if="props.error">
          {{ props.error }}
        </template>
        <template v-else>
          {{ props.searchEmptyLabel }}
        </template>
      </div>
    </template>
  </BaseSidebar>
</template>

<style lang="scss">
@use '@/views/Messaging/components/MessagingSidebar/messaging-sidebar.scss';
</style>
