import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { MessageAuthorRole, MessageState, Prisma } from '@prisma/client'

import { PrismaService } from '@/common/prisma/prisma.service'
import type { AuthUser } from '@/auth/interfaces/auth-user.interface'
import type { CreateConversationDto } from '@/messaging/dto/create-conversation.dto'
import type { ListConversationsQueryDto } from '@/messaging/dto/list-conversations-query.dto'
import type { SendMessageDto } from '@/messaging/dto/send-message.dto'
import { createConversationPublicId, createMessagePublicId } from '@/shared/id.utils'
import { toStringOrEmpty } from '@/shared/json.utils'

@Injectable()
export class MessagingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listConversations(query: ListConversationsQueryDto, authUser: AuthUser | null) {
    const guestIdentifier = toStringOrEmpty(query.guestIdentifier)
    const listingId = toStringOrEmpty(query.listingId)
    const reservationId = toStringOrEmpty(query.reservationId)

    if (!authUser?.userId && !guestIdentifier) {
      throw new ForbiddenException('Authentication or guest identifier is required')
    }

    const where: Prisma.ConversationWhereInput = {
      ...(listingId ? { listing: { publicId: listingId } } : {}),
      ...(reservationId ? { reservation: { publicId: reservationId } } : {}),
      ...(guestIdentifier
        ? {
            participants: {
              some: {
                guestIdentity: {
                  publicId: guestIdentifier,
                },
              },
            },
          }
        : {}),
      ...(authUser?.userId
        ? {
            OR: [
              {
                listing: {
                  owner: {
                    clerkUserId: authUser.userId,
                  },
                },
              },
              {
                participants: {
                  some: {
                    user: {
                      clerkUserId: authUser.userId,
                    },
                  },
                },
              },
            ],
          }
        : {}),
    }

    const conversations = await this.prisma.conversation.findMany({
      where,
      include: {
        listing: {
          include: { core: true },
        },
        reservation: true,
        participants: {
          include: {
            user: true,
            guestIdentity: true,
          },
        },
        messages: {
          orderBy: { sentAt: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return conversations.map((conversation) => ({
      id: conversation.publicId,
      listingId: conversation.listing.publicId,
      reservationId: conversation.reservation?.publicId ?? null,
      subject: conversation.subject,
      updatedAt: conversation.updatedAt.toISOString(),
      participants: conversation.participants.map((participant) => ({
        role: participant.role.toLowerCase(),
        userId: participant.user?.clerkUserId ?? null,
        guestIdentifier: participant.guestIdentity?.publicId ?? null,
        displayName: participant.displayName,
      })),
      messages: conversation.messages.map((message) => ({
        id: message.publicId,
        author: mapAuthorRoleToApi(message.authorRole),
        body: message.body,
        state: mapMessageStateToApi(message.state),
        sentAt: message.sentAt.toISOString(),
      })),
    }))
  }

  async createConversation(payload: CreateConversationDto, authUser: AuthUser | null) {
    if (!authUser?.userId && !toStringOrEmpty(payload.guestIdentifier)) {
      throw new ForbiddenException('Authentication or guest identifier is required')
    }

    const listing = await this.prisma.listing.findUnique({
      where: { publicId: payload.listingId },
      include: {
        owner: true,
      },
    })

    if (!listing) {
      throw new NotFoundException(`Listing ${payload.listingId} not found`)
    }

    const reservationPublicId = toStringOrEmpty(payload.reservationId)
    const reservation = reservationPublicId
      ? await this.prisma.reservation.findUnique({
          where: { publicId: reservationPublicId },
        })
      : null

    if (reservation && reservation.listingId !== listing.id) {
      throw new ForbiddenException('Reservation does not belong to this listing')
    }

    const conversationPublicId =
      reservationPublicId
        ? createConversationPublicId(listing.publicId, reservationPublicId)
        : createConversationPublicId(listing.publicId)

    const conversation = await this.prisma.conversation.upsert({
      where: {
        publicId: conversationPublicId,
      },
      update: {
        listingId: listing.id,
        reservationId: reservation?.id,
        subject: toStringOrEmpty(payload.subject) || null,
      },
      create: {
        publicId: conversationPublicId,
        listingId: listing.id,
        reservationId: reservation?.id,
        subject: toStringOrEmpty(payload.subject) || null,
      },
    })

    if (listing.ownerId) {
      await this.prisma.conversationParticipant.upsert({
        where: {
          id: `${conversation.id}:host:${listing.ownerId}`,
        },
        update: {
          role: 'HOST',
          userId: listing.ownerId,
          displayName: listing.owner?.firstName ?? 'Hôte',
        },
        create: {
          id: `${conversation.id}:host:${listing.ownerId}`,
          conversationId: conversation.id,
          role: 'HOST',
          userId: listing.ownerId,
          displayName: listing.owner?.firstName ?? 'Hôte',
        },
      })
    }

    const guestIdentifier = toStringOrEmpty(payload.guestIdentifier)
    if (guestIdentifier) {
      const guestIdentity = await this.prisma.guestIdentity.upsert({
        where: {
          publicId: guestIdentifier,
        },
        update: {
          ...(toStringOrEmpty(payload.guestName)
            ? { displayName: toStringOrEmpty(payload.guestName) }
            : {}),
        },
        create: {
          publicId: guestIdentifier,
          displayName: toStringOrEmpty(payload.guestName) || 'Voyageur',
        },
      })

      await this.prisma.conversationParticipant.upsert({
        where: {
          id: `${conversation.id}:guest:${guestIdentity.id}`,
        },
        update: {
          role: 'GUEST',
          guestIdentityId: guestIdentity.id,
          displayName: guestIdentity.displayName ?? 'Voyageur',
        },
        create: {
          id: `${conversation.id}:guest:${guestIdentity.id}`,
          conversationId: conversation.id,
          role: 'GUEST',
          guestIdentityId: guestIdentity.id,
          displayName: guestIdentity.displayName ?? 'Voyageur',
        },
      })
    }

    if (authUser?.userId) {
      const user = await this.prisma.user.upsert({
        where: { clerkUserId: authUser.userId },
        update: {},
        create: {
          clerkUserId: authUser.userId,
          role: 'HOST',
          email: authUser.email,
        },
      })

      await this.prisma.conversationParticipant.upsert({
        where: {
          id: `${conversation.id}:host:${user.id}`,
        },
        update: {
          role: 'HOST',
          userId: user.id,
        },
        create: {
          id: `${conversation.id}:host:${user.id}`,
          conversationId: conversation.id,
          role: 'HOST',
          userId: user.id,
        },
      })
    }

    return {
      conversationId: conversation.publicId,
    }
  }

  async listMessages(conversationId: string, authUser: AuthUser | null, guestIdentifier?: string) {
    const conversation = await this.findConversationOrThrow(conversationId)
    await this.ensureConversationAccess(conversation.id, authUser, guestIdentifier)

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId: conversation.id,
      },
      orderBy: { sentAt: 'asc' },
    })

    return messages.map((message) => ({
      id: message.publicId,
      author: mapAuthorRoleToApi(message.authorRole),
      body: message.body,
      state: mapMessageStateToApi(message.state),
      sentAt: message.sentAt.toISOString(),
    }))
  }

  async sendMessage(
    conversationPublicId: string,
    payload: SendMessageDto,
    authUser: AuthUser | null,
    fallbackGuestIdentifier?: string,
  ) {
    const conversation = await this.findConversationOrThrow(conversationPublicId)
    const guestIdentifier = toStringOrEmpty(payload.guestIdentifier) || toStringOrEmpty(fallbackGuestIdentifier)
    await this.ensureConversationAccess(conversation.id, authUser, guestIdentifier)

    const author = resolveMessageAuthor(payload.author, authUser, guestIdentifier)

    let authorUserId: string | null = null
    let authorGuestIdentityId: string | null = null

    if (author === MessageAuthorRole.HOST && authUser?.userId) {
      const user = await this.prisma.user.upsert({
        where: { clerkUserId: authUser.userId },
        update: {},
        create: {
          clerkUserId: authUser.userId,
          role: 'HOST',
          email: authUser.email,
        },
      })

      authorUserId = user.id

      await this.prisma.conversationParticipant.upsert({
        where: {
          id: `${conversation.id}:host:${user.id}`,
        },
        update: { role: 'HOST', userId: user.id },
        create: {
          id: `${conversation.id}:host:${user.id}`,
          conversationId: conversation.id,
          role: 'HOST',
          userId: user.id,
          displayName: user.firstName ?? 'Hôte',
        },
      })
    }

    if (author === MessageAuthorRole.GUEST) {
      if (!guestIdentifier) {
        throw new ForbiddenException('Guest identifier is required for guest messages')
      }

      const guestIdentity = await this.prisma.guestIdentity.upsert({
        where: {
          publicId: guestIdentifier,
        },
        update: {},
        create: {
          publicId: guestIdentifier,
        },
      })

      authorGuestIdentityId = guestIdentity.id

      await this.prisma.conversationParticipant.upsert({
        where: {
          id: `${conversation.id}:guest:${guestIdentity.id}`,
        },
        update: {
          role: 'GUEST',
          guestIdentityId: guestIdentity.id,
        },
        create: {
          id: `${conversation.id}:guest:${guestIdentity.id}`,
          conversationId: conversation.id,
          role: 'GUEST',
          guestIdentityId: guestIdentity.id,
          displayName: guestIdentity.displayName ?? 'Voyageur',
        },
      })
    }

    const message = await this.prisma.message.create({
      data: {
        publicId: createMessagePublicId(conversation.publicId),
        conversationId: conversation.id,
        reservationId: conversation.reservationId,
        authorRole: author,
        userId: authorUserId,
        guestIdentityId: authorGuestIdentityId,
        body: payload.body.trim(),
        state: MessageState.SENT,
      },
    })

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    })

    return {
      id: message.publicId,
      author: mapAuthorRoleToApi(message.authorRole),
      body: message.body,
      state: mapMessageStateToApi(message.state),
      sentAt: message.sentAt.toISOString(),
    }
  }

  async markMessageState(
    conversationPublicId: string,
    messagePublicId: string,
    state: 'read' | 'delivered' | 'sent',
    authUser: AuthUser | null,
    guestIdentifier?: string,
  ) {
    const conversation = await this.findConversationOrThrow(conversationPublicId)
    await this.ensureConversationAccess(conversation.id, authUser, guestIdentifier)

    const message = await this.prisma.message.findUnique({
      where: { publicId: messagePublicId },
    })

    if (!message || message.conversationId !== conversation.id) {
      throw new NotFoundException(`Message ${messagePublicId} not found in conversation ${conversationPublicId}`)
    }

    const updated = await this.prisma.message.update({
      where: { id: message.id },
      data: {
        state: mapApiStateToDb(state),
      },
    })

    return {
      id: updated.publicId,
      state: mapMessageStateToApi(updated.state),
    }
  }

  private async findConversationOrThrow(publicId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { publicId },
    })

    if (!conversation) {
      throw new NotFoundException(`Conversation ${publicId} not found`)
    }

    return conversation
  }

  private async ensureConversationAccess(conversationId: string, authUser: AuthUser | null, guestIdentifier?: string) {
    if (authUser?.userId) return

    const normalizedGuestIdentifier = toStringOrEmpty(guestIdentifier)
    if (!normalizedGuestIdentifier) {
      throw new ForbiddenException('Missing authentication or guest identifier')
    }

    const participant = await this.prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        guestIdentity: {
          publicId: normalizedGuestIdentifier,
        },
      },
    })

    if (!participant) {
      throw new ForbiddenException('Conversation access denied for guest identifier')
    }
  }
}

function resolveMessageAuthor(
  requestedAuthor: SendMessageDto['author'],
  authUser: AuthUser | null,
  guestIdentifier: string,
): MessageAuthorRole {
  if (requestedAuthor === 'guest' && guestIdentifier) return MessageAuthorRole.GUEST
  if (requestedAuthor === 'host' && authUser?.userId) return MessageAuthorRole.HOST
  if (authUser?.userId) return MessageAuthorRole.HOST
  return MessageAuthorRole.GUEST
}

function mapAuthorRoleToApi(authorRole: MessageAuthorRole): 'host' | 'guest' {
  if (authorRole === MessageAuthorRole.GUEST) return 'guest'
  return 'host'
}

function mapMessageStateToApi(state: MessageState): 'sent' | 'delivered' | 'read' {
  if (state === MessageState.READ) return 'read'
  if (state === MessageState.DELIVERED) return 'delivered'
  return 'sent'
}

function mapApiStateToDb(state: 'read' | 'delivered' | 'sent'): MessageState {
  if (state === 'read') return MessageState.READ
  if (state === 'delivered') return MessageState.DELIVERED
  return MessageState.SENT
}
