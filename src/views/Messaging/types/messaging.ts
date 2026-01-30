// File: src/views/Messaging/types/messaging.ts

export type MessageDirection = 'incoming' | 'outgoing'
export type MessageState = 'sent' | 'delivered' | 'read'
export type ConversationStatus = 'active' | 'pending' | 'archived'

export type MessagingParticipant = {
  id: string
  name: string
  initials: string
  tone: string
}

export type MessagingMessage = {
  id: string
  authorId: string
  direction: MessageDirection
  body: string
  sentAtLabel: string
  state: MessageState
}

export type MessagingConversation = {
  id: string
  status: ConversationStatus
  isPinned: boolean
  unreadCount: number
  updatedAtLabel: string
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
    startDate: string
    endDate: string
    nights: number
    guests: number
    total: string
    currency: string
    source: string
  }
  participants: {
    host: MessagingParticipant
    guest: MessagingParticipant
  }
  lastMessage: {
    author: 'host' | 'guest'
    preview: string
    sentAtLabel: string
  }
  messages: MessagingMessage[]
}
