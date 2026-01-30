<!-- File: src/views/Messaging/components/MessagingThread/MessagingThread.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import { MoreHorizontal, Paperclip, Send } from 'lucide-vue-next'

import type { MessagingConversation, MessageState } from '@/views/Messaging/types/messaging'

const props = defineProps<{
  conversation: MessagingConversation | null
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
  composer: {
    placeholder: string
    send: string
    hint: string
  }
  emptyState: {
    title: string
    subtitle: string
  }
  conversationStates: Record<string, string>
  deliveryStates: Record<MessageState, string>
}>()

const host = computed(() => props.conversation?.participants.host ?? null)
const guest = computed(() => props.conversation?.participants.guest ?? null)
</script>

<template>
  <section class="messaging-thread">
    <template v-if="props.conversation">
      <div class="thread-header header">
        <div class="identity">
          <div
            class="avatar"
            :data-tone="guest?.tone"
          >
            <span>{{ guest?.initials }}</span>
          </div>
          <div>
            <p class="name">{{ guest?.name }}</p>
            <p class="listing">{{ props.conversation.listing.title }}</p>
          </div>
        </div>

        <div class="meta">
          <div class="reservation">
            <div class="tag">
              <span>{{ props.labels.reservation }}</span>
              <strong>{{ props.conversation.reservation.code }}</strong>
            </div>
            <div class="details">
              <span>{{ props.conversation.reservation.startDate }} → {{ props.conversation.reservation.endDate }}</span>
              <span>{{ props.conversation.reservation.nights }} {{ props.labels.nights }}</span>
              <span>{{ props.conversation.reservation.guests }} {{ props.labels.guests }}</span>
            </div>
          </div>
          <div class="status">
            <span class="pill">
              {{ props.conversationStates[props.conversation.status] ?? props.conversation.status }}
            </span>
            <button
              class="icon-btn"
              type="button"
              aria-label="Options"
            >
              <MoreHorizontal />
            </button>
          </div>
        </div>
      </div>

      <div class="thread-body">
        <div class="message-list">
          <div
            v-for="message in props.conversation.messages"
            :key="message.id"
            class="message-row"
            :class="[`is-${message.direction}`]"
          >
            <div
              v-if="message.direction === 'incoming'"
              class="avatar"
              :data-tone="guest?.tone"
            >
              <span>{{ guest?.initials }}</span>
            </div>

            <div class="bubble">
              <p>{{ message.body }}</p>
              <div class="meta">
                <span class="time">{{ message.sentAtLabel }}</span>
                <span
                  v-if="message.direction === 'outgoing'"
                  class="state"
                >
                  {{ props.deliveryStates[message.state] }}
                </span>
              </div>
            </div>

            <div
              v-if="message.direction === 'outgoing'"
              class="avatar"
              :data-tone="host?.tone"
            >
              <span>{{ host?.initials }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="thread-composer footer">
        <button
          class="icon-btn"
          type="button"
          aria-label="Ajouter une pièce jointe"
        >
          <Paperclip />
        </button>

        <div class="composer-input">
          <div class="composer-field">
            <textarea
              rows="1"
              :placeholder="props.composer.placeholder"
            />
          </div>
          <!-- <small>{{ props.composer.hint }}</small> -->
        </div>

        <div class="send">
          <button
            type="button"
            aria-label="Envoyer"
          >
            <Send />
            {{ props.composer.send }}
          </button>
        </div>
      </div>
    </template>

    <div
      v-else
      class="thread-empty"
    >
      <h2>{{ props.emptyState.title }}</h2>
      <p>{{ props.emptyState.subtitle }}</p>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Messaging/components/MessagingThread/messaging-thread.scss';
</style>
