import { Injectable } from '@nestjs/common'

import type { AuthUser } from '@/auth/interfaces/auth-user.interface'
import type { CreateConversationDto } from '@/messaging/dto/create-conversation.dto'
import type { ListConversationsQueryDto } from '@/messaging/dto/list-conversations-query.dto'
import type { MarkMessageReadDto } from '@/messaging/dto/mark-message-read.dto'
import type { SendMessageDto } from '@/messaging/dto/send-message.dto'
import { MessagingRepository } from '@/messaging/messaging.repository'

@Injectable()
export class MessagingService {
  constructor(private readonly messagingRepository: MessagingRepository) {}

  async listConversations(query: ListConversationsQueryDto, authUser: AuthUser | null) {
    return this.messagingRepository.listConversations(query, authUser)
  }

  async createConversation(payload: CreateConversationDto, authUser: AuthUser | null) {
    return this.messagingRepository.createConversation(payload, authUser)
  }

  async listMessages(conversationId: string, authUser: AuthUser | null, guestIdentifier?: string) {
    return this.messagingRepository.listMessages(conversationId, authUser, guestIdentifier)
  }

  async sendMessage(
    conversationId: string,
    payload: SendMessageDto,
    authUser: AuthUser | null,
    guestIdentifier?: string,
  ) {
    return this.messagingRepository.sendMessage(conversationId, payload, authUser, guestIdentifier)
  }

  async markMessageState(
    conversationId: string,
    messageId: string,
    payload: MarkMessageReadDto,
    authUser: AuthUser | null,
    guestIdentifier?: string,
  ) {
    return this.messagingRepository.markMessageState(
      conversationId,
      messageId,
      payload.state ?? 'read',
      authUser,
      guestIdentifier,
    )
  }
}
