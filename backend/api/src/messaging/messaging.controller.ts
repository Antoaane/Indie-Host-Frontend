import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'

import { CurrentAuth } from '@/auth/decorators/current-auth.decorator'
import { OptionalClerkAuthGuard } from '@/auth/guards/optional-clerk-auth.guard'
import type { AuthUser } from '@/auth/interfaces/auth-user.interface'
import { CreateConversationDto } from '@/messaging/dto/create-conversation.dto'
import { ListConversationsQueryDto } from '@/messaging/dto/list-conversations-query.dto'
import { MarkMessageReadDto } from '@/messaging/dto/mark-message-read.dto'
import { SendMessageDto } from '@/messaging/dto/send-message.dto'
import { MessagingService } from '@/messaging/messaging.service'

@Controller('messaging')
@UseGuards(OptionalClerkAuthGuard)
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('conversations')
  async listConversations(
    @Query() query: ListConversationsQueryDto,
    @CurrentAuth() authUser: AuthUser | null,
  ) {
    return this.messagingService.listConversations(query, authUser)
  }

  @Post('conversations')
  async createConversation(
    @Body() payload: CreateConversationDto,
    @CurrentAuth() authUser: AuthUser | null,
  ) {
    return this.messagingService.createConversation(payload, authUser)
  }

  @Get('conversations/:conversationId/messages')
  async listMessages(
    @Param('conversationId') conversationId: string,
    @CurrentAuth() authUser: AuthUser | null,
    @Headers('x-guest-id') guestIdentifier?: string,
  ) {
    return this.messagingService.listMessages(conversationId, authUser, guestIdentifier)
  }

  @Post('conversations/:conversationId/messages')
  async sendMessage(
    @Param('conversationId') conversationId: string,
    @Body() payload: SendMessageDto,
    @CurrentAuth() authUser: AuthUser | null,
    @Headers('x-guest-id') guestIdentifier?: string,
  ) {
    return this.messagingService.sendMessage(conversationId, payload, authUser, guestIdentifier)
  }

  @Patch('conversations/:conversationId/messages/:messageId/state')
  async markMessageState(
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
    @Body() payload: MarkMessageReadDto,
    @CurrentAuth() authUser: AuthUser | null,
    @Headers('x-guest-id') guestIdentifier?: string,
  ) {
    return this.messagingService.markMessageState(conversationId, messageId, payload, authUser, guestIdentifier)
  }
}
