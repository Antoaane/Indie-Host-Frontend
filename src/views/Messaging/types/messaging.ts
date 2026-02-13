// File: src/views/Messaging/types/messaging.ts

import type { RawReservationMessageState } from '@/domain/listings/types'

export type MessageDirection = 'incoming' | 'outgoing'
export type MessageState = RawReservationMessageState
export type ConversationStatus = 'active' | 'pending' | 'archived'

export type MessagingParticipant = {
  id: string
  name: string
  initials: string
  tone: string
}

export type MessagingMessage = {
  id: string
  author: 'host' | 'guest'
  direction: MessageDirection
  body: string
  sentAt: string
  sentAtLabel: string
  state: MessageState
}

export type MessagingConversation = {
  id: string
  listingId: string
  reservationId: string
  status: ConversationStatus
  isPinned: boolean
  unreadCount: number
  updatedAt: string
  updatedAtLabel: string
  searchIndex: string
  listing: {
    id: string
    title: string
    location: string
    cover: string
  }
  reservation: {
    id: string
    code: string
    status: string
    startISO: string
    endISO: string
    startDate: string
    endDate: string
    nights: number
    guests: number
    total: string
    currency: string
    source: string
    paymentStatus: string
  }
  participants: {
    host: MessagingParticipant
    guest: MessagingParticipant
  }
  lastMessage: {
    author: 'host' | 'guest'
    preview: string
    sentAt: string
    sentAtLabel: string
    state: MessageState
  }
  messages: MessagingMessage[]
}
