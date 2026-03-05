<!-- File: src/views/Messaging/MessagingView.vue -->

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { normalizeReservations } from '@/domain/listings/bookings'
import type { RawBookingReservation, RawBookings, RawHost, RawReservationMessage, UserListingCard } from '@/domain/listings/types'
import { vp } from '@/utils/viewport'
import type { EditorMode, EditorSource } from '@/views/Editor/types/editor'
import MessagingSidebar from '@/views/Messaging/components/MessagingSidebar/MessagingSidebar.vue'
import MessagingThread from '@/views/Messaging/components/MessagingThread/MessagingThread.vue'
import { buildMessagingConversations, createOutgoingReservationMessage, ensureReservationThreadMessages, markIncomingMessagesRead, markLatestIncomingMessageUnread } from '@/views/Messaging/utils/messagingConversations'
import { messagingStatic } from '@/views/Messaging/utils/messagingContent'
import type { MessagingConversation } from '@/views/Messaging/types/messaging'

const props = defineProps<{
  mode: EditorMode
  source: EditorSource
}>()

const route = useRoute()
const router = useRouter()

const selectedConversationId = ref<string | null>(null)
const isMobileThreadOpen = ref(false)

const listings = ref<UserListingCard[]>([])
const reservationsByListingId = reactive<Record<string, RawBookingReservation[]>>({})
const hostsByListingId = reactive<Record<string, Partial<RawHost> | null>>({})

const messagingStatus = reactive({
  isLoading: false,
  error: null as string | null,
})

const actionStatus = reactive({
  isPending: false,
  error: null as string | null,
})

const conversations = computed<MessagingConversation[]>(() =>
  buildMessagingConversations({
    listings: listings.value,
    reservationsByListingId,
    hostsByListingId,
  }),
)

const selectedConversation = computed(() => conversations.value.find((conversation) => conversation.id === selectedConversationId.value) ?? null)
const isMobileViewport = computed(() => !vp.lg.value)
const isMobileConversationStep = computed(() => isMobileViewport.value && isMobileThreadOpen.value && Boolean(selectedConversation.value))

function resetMessagingMaps() {
  for (const key of Object.keys(reservationsByListingId)) {
    delete reservationsByListingId[key]
  }

  for (const key of Object.keys(hostsByListingId)) {
    delete hostsByListingId[key]
  }
}

async function refreshListingConversationData(listingId: string) {
  const volatile = await props.source.fetchVolatileListingBundle(listingId)
  const bookings = (volatile.bookings ?? null) as Partial<RawBookings> | null
  reservationsByListingId[listingId] = normalizeReservations(bookings?.reservations)
  hostsByListingId[listingId] = (volatile.host ?? null) as Partial<RawHost> | null
}

async function bootstrap() {
  messagingStatus.isLoading = true
  messagingStatus.error = null

  try {
    listings.value = await props.source.fetchListings()
    resetMessagingMaps()

    const results = await Promise.allSettled(
      listings.value.map(async (listing) => {
        await refreshListingConversationData(listing.listingId)
      }),
    )

    const failed = results.find((result) => result.status === 'rejected')
    if (failed && failed.status === 'rejected') {
      messagingStatus.error = messagingStatic.errors?.load ?? 'Impossible de charger les conversations.'
      console.error('[Messaging] failed to load listing conversations', failed.reason)
    }
  } catch (error) {
    console.error('[Messaging] bootstrap failed', error)
    messagingStatus.error = messagingStatic.errors?.load ?? 'Impossible de charger les conversations.'
    listings.value = []
    resetMessagingMaps()
  } finally {
    messagingStatus.isLoading = false
  }
}

function findConversationById(conversationId: string) {
  return conversations.value.find((conversation) => conversation.id === conversationId) ?? null
}

async function patchConversationMessages(
  conversation: MessagingConversation,
  mutate: (
    messages: RawReservationMessage[],
    reservation: RawBookingReservation,
  ) => {
    changed: boolean
    messages: RawReservationMessage[]
  },
) {
  const listingId = conversation.listingId
  const reservationId = conversation.reservationId
  const editable = await props.source.fetchEditableListingBundle(listingId)
  const bookings = (editable.bookings ?? null) as Partial<RawBookings> | null
  const reservations = normalizeReservations(bookings?.reservations)
  const reservationIndex = reservations.findIndex((reservation) => reservation.id === reservationId)

  if (reservationIndex < 0) {
    await refreshListingConversationData(listingId)
    return false
  }

  const targetReservation = reservations[reservationIndex]
  const currentMessages = ensureReservationThreadMessages(targetReservation)
  const { changed, messages } = mutate(currentMessages, targetReservation)

  if (!changed) return false

  const nextReservation: RawBookingReservation = {
    ...targetReservation,
    messaging: {
      ...(targetReservation.messaging?.conversationId ? { conversationId: targetReservation.messaging.conversationId } : { conversationId: conversation.id }),
      messages,
    },
  }

  const nextReservations = [
    ...reservations,
  ]
  nextReservations[reservationIndex] = nextReservation
  const normalizedNextReservations = normalizeReservations(nextReservations)

  await props.source.patchListingDraft(listingId, {
    bookings: {
      reservations: normalizedNextReservations,
    },
  })

  reservationsByListingId[listingId] = normalizedNextReservations
  return true
}

async function markConversationRead(conversationId: string, options?: { silent?: boolean }) {
  const conversation = findConversationById(conversationId)
  if (!conversation || conversation.unreadCount < 1) return

  if (!options?.silent) {
    actionStatus.isPending = true
    actionStatus.error = null
  }

  try {
    await patchConversationMessages(conversation, (messages) => markIncomingMessagesRead(messages))
  } catch (error) {
    console.error('[Messaging] mark read failed', error)
    if (!options?.silent) {
      actionStatus.error = messagingStatic.errors?.update ?? 'Impossible de mettre a jour la conversation.'
    }
  } finally {
    if (!options?.silent) {
      actionStatus.isPending = false
    }
  }
}

async function handleMarkConversationUnread(conversationId: string) {
  const conversation = findConversationById(conversationId)
  if (!conversation) return

  actionStatus.isPending = true
  actionStatus.error = null

  try {
    await patchConversationMessages(conversation, (messages) => markLatestIncomingMessageUnread(messages))
  } catch (error) {
    console.error('[Messaging] mark unread failed', error)
    actionStatus.error = messagingStatic.errors?.update ?? 'Impossible de mettre a jour la conversation.'
  } finally {
    actionStatus.isPending = false
  }
}

async function handleSendMessage(payload: { conversationId: string; body: string }) {
  const conversation = findConversationById(payload.conversationId)
  const messageBody = payload.body.trim()
  if (!conversation || !messageBody) return

  actionStatus.isPending = true
  actionStatus.error = null

  try {
    await patchConversationMessages(conversation, (messages, reservation) => ({
      changed: true,
      messages: [
        ...messages,
        createOutgoingReservationMessage(reservation, messageBody),
      ],
    }))
  } catch (error) {
    console.error('[Messaging] send message failed', error)
    actionStatus.error = messagingStatic.errors?.send ?? 'Impossible d envoyer le message.'
  } finally {
    actionStatus.isPending = false
  }
}

function handleOpenReservation(conversationId: string) {
  const conversation = findConversationById(conversationId)
  if (!conversation) return

  const userId = typeof route.params.userId === 'string' && route.params.userId.trim() ? route.params.userId.trim() : null

  if (userId) {
    void router.push({
      name: 'management-user',
      params: { userId },
      query: {
        listingId: conversation.listingId,
        reservationId: conversation.reservationId,
      },
    })
    return
  }

  void router.push({
    name: 'management',
    query: {
      listingId: conversation.listingId,
      reservationId: conversation.reservationId,
    },
  })
}

function handleSelectConversation(conversationId: string) {
  if (isMobileViewport.value) {
    isMobileThreadOpen.value = true
  }
  selectedConversationId.value = conversationId
  void markConversationRead(conversationId, { silent: true })
}

function handleBackToConversationList() {
  isMobileThreadOpen.value = false
}

function normalizeQueryParam(value: unknown): string | null {
  if (Array.isArray(value)) return normalizeQueryParam(value[0])
  if (typeof value === 'string' && value.trim()) return value.trim()
  return null
}

function clearRouteConversationSelectionQuery() {
  const nextQuery = {
    ...route.query,
  }
  const hasSelectionQuery = 'conversationId' in nextQuery || 'listingId' in nextQuery || 'reservationId' in nextQuery
  if (!hasSelectionQuery) return

  delete nextQuery.conversationId
  delete nextQuery.listingId
  delete nextQuery.reservationId

  void router.replace({ query: nextQuery })
}

function applyRouteConversationSelection(items: MessagingConversation[]) {
  const conversationIdFromQuery = normalizeQueryParam(route.query.conversationId)
  const listingIdFromQuery = normalizeQueryParam(route.query.listingId)
  const reservationIdFromQuery = normalizeQueryParam(route.query.reservationId)

  if (!conversationIdFromQuery && !listingIdFromQuery && !reservationIdFromQuery) {
    return false
  }

  let target = conversationIdFromQuery
    ? items.find((conversation) => conversation.id === conversationIdFromQuery) ?? null
    : null

  if (!target && (listingIdFromQuery || reservationIdFromQuery)) {
    target = items.find((conversation) => {
      if (listingIdFromQuery && conversation.listingId !== listingIdFromQuery) return false
      if (reservationIdFromQuery && conversation.reservationId !== reservationIdFromQuery) return false
      return true
    }) ?? null
  }

  if (!target) return false

  if (selectedConversationId.value !== target.id) {
    selectedConversationId.value = target.id
    void markConversationRead(target.id, { silent: true })
  }

  if (isMobileViewport.value) {
    isMobileThreadOpen.value = true
  }

  clearRouteConversationSelectionQuery()
  return true
}

watch(
  () => props.source,
  () => {
    listings.value = []
    selectedConversationId.value = null
    resetMessagingMaps()
    actionStatus.error = null
    void bootstrap()
  },
  { immediate: true },
)

watch(
  () => [
    route.query.conversationId,
    route.query.listingId,
    route.query.reservationId,
  ],
  () => {
    applyRouteConversationSelection(conversations.value)
  },
)

watch(conversations, (items) => {
  if (!items.length) {
    selectedConversationId.value = null
    isMobileThreadOpen.value = false
    return
  }

  if (applyRouteConversationSelection(items)) return

  if (!selectedConversationId.value || !items.some((conversation) => conversation.id === selectedConversationId.value)) {
    selectedConversationId.value = items[0].id
  }
})

watch(
  isMobileViewport,
  () => {
    isMobileThreadOpen.value = false
  },
  { immediate: true },
)

watch(selectedConversationId, (conversationId) => {
  if (conversationId) return
  isMobileThreadOpen.value = false
})
</script>

<template>
  <main
    id="messaging-page"
    class="messaging"
  >
    <div
      class="layout"
      :class="{ 'is-mobile-thread': isMobileConversationStep }"
    >
      <MessagingSidebar
        :conversations="conversations"
        :selectedId="selectedConversationId"
        :searchPlaceholder="messagingStatic.searchPlaceholder"
        :searchEmptyLabel="messagingStatic.searchEmpty"
        :labels="messagingStatic.labels"
        :isLoading="messagingStatus.isLoading"
        :error="messagingStatus.error"
        @select="handleSelectConversation"
      />

      <div
        class="thread-shell"
        :class="{ 'is-mobile-open': isMobileConversationStep }"
      >
        <MessagingThread
          :conversation="selectedConversation"
          :labels="messagingStatic.labels"
          :composer="messagingStatic.composer"
          :emptyState="messagingStatic.emptyState"
          :conversationStates="messagingStatic.conversationStates"
          :deliveryStates="messagingStatic.deliveryStates"
          :options="messagingStatic.options"
          :showMobileBack="isMobileViewport"
          :isActionPending="actionStatus.isPending"
          :error="actionStatus.error"
          @back="handleBackToConversationList"
          @send="handleSendMessage"
          @open-reservation="handleOpenReservation"
          @mark-read="markConversationRead"
          @mark-unread="handleMarkConversationUnread"
        />
      </div>
    </div>
  </main>
</template>

<style lang="scss">
@use '@/views/Messaging/messaging.scss';
</style>
