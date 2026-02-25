<!-- File: src/views/Messaging/components/MessagingThread/MessagingThread.vue -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MoreHorizontal, Paperclip, Send } from 'lucide-vue-next'

import RelativeOverlay from '@/components/overlays/RelativeOverlay.vue'
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
  options: {
    title: string
    openReservation: string
    markRead: string
    markUnread: string
  }
  isActionPending?: boolean
  error?: string | null
}>()

const emit = defineEmits<{
  (event: 'send', payload: { conversationId: string; body: string }): void
  (event: 'open-reservation', conversationId: string): void
  (event: 'mark-read', conversationId: string): void
  (event: 'mark-unread', conversationId: string): void
}>()

const host = computed(() => props.conversation?.participants.host ?? null)
const guest = computed(() => props.conversation?.participants.guest ?? null)
const composerDraft = ref('')
const optionsOpen = ref(false)
const optionsAnchor = ref<HTMLElement | null>(null)

const canSend = computed(() => !!props.conversation && !props.isActionPending && composerDraft.value.trim().length > 0)

const hasUnread = computed(() => (props.conversation?.unreadCount ?? 0) > 0)

function closeOptions() {
  optionsOpen.value = false
}

function toggleOptions(event: MouseEvent) {
  const anchor = event.currentTarget
  if (anchor instanceof HTMLElement) {
    optionsAnchor.value = anchor
  }
  optionsOpen.value = !optionsOpen.value
}

function submitMessage() {
  if (!canSend.value || !props.conversation) return
  emit('send', {
    conversationId: props.conversation.id,
    body: composerDraft.value.trim(),
  })
  composerDraft.value = ''
}

function handleComposerKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey) return
  event.preventDefault()
  submitMessage()
}

function handleOpenReservation() {
  if (!props.conversation) return
  emit('open-reservation', props.conversation.id)
  closeOptions()
}

function handleMarkRead() {
  if (!props.conversation) return
  emit('mark-read', props.conversation.id)
  closeOptions()
}

function handleMarkUnread() {
  if (!props.conversation) return
  emit('mark-unread', props.conversation.id)
  closeOptions()
}

watch(
  () => props.conversation?.id,
  () => {
    composerDraft.value = ''
    closeOptions()
  },
)
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
            <div class="icon-btn">
              <button
                type="button"
                aria-label="Options"
                :disabled="props.isActionPending"
                @click="toggleOptions"
              >
                <MoreHorizontal :size="20" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <RelativeOverlay
        class="thread-options-overlay"
        :open="optionsOpen"
        :anchor="optionsAnchor"
        placement="bottom-end"
        :offset="10"
        :viewport-padding="12"
        :trap-focus="true"
        role="menu"
        :aria-label="props.options.title"
        @close="closeOptions"
      >
        <div class="thread-options-panel">
          <button
            type="button"
            class="action"
            :disabled="props.isActionPending"
            @click="handleOpenReservation"
          >
            {{ props.options.openReservation }}
          </button>

          <button
            v-if="hasUnread"
            type="button"
            class="action"
            :disabled="props.isActionPending"
            @click="handleMarkRead"
          >
            {{ props.options.markRead }}
          </button>

          <button
            v-else
            type="button"
            class="action"
            :disabled="props.isActionPending"
            @click="handleMarkUnread"
          >
            {{ props.options.markUnread }}
          </button>
        </div>
      </RelativeOverlay>

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
        <div class="icon-btn">
          <button
            type="button"
            aria-label="Ajouter une pièce jointe"
          >
            <Paperclip :size="20" />
          </button>
        </div>

        <div class="composer-input">
          <div class="composer-field">
            <textarea
              v-model="composerDraft"
              rows="1"
              :placeholder="props.composer.placeholder"
              :disabled="props.isActionPending"
              @keydown="handleComposerKeydown"
            />
          </div>
          <!-- <small>{{ props.composer.hint }}</small> -->
        </div>

        <div class="send">
          <button
            type="button"
            aria-label="Envoyer"
            :disabled="!canSend"
            @click="submitMessage"
          >
            <Send :size="20" />
            {{ props.isActionPending ? 'Envoi...' : props.composer.send }}
          </button>
        </div>
      </div>

      <p
        v-if="props.error"
        class="composer-error"
      >
        {{ props.error }}
      </p>
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
