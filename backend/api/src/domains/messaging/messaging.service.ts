import type { PrismaClient } from '@prisma/client';

import { buildMessageId } from '../../lib/id.js';
import { hasAdminAccess } from '../../lib/authRole.js';
import type { RequestAuth } from '../../types/auth.js';
import { upsertUserFromAuth } from '../users/users.repository.js';

type ListConversationsInput = {
  listingId?: string;
  reservationId?: string;
  guestTempId?: string;
};

type CreateConversationInput = {
  listingId: string;
  reservationId?: string;
  guestTempId?: string;
  guestUserId?: string;
  subject?: string;
};

type SendMessageInput = {
  body: string;
  author?: 'host' | 'guest' | 'system';
  state?: 'sent' | 'delivered' | 'read';
  guestTempId?: string;
};

export class MessagingService {
  constructor(private readonly prisma: PrismaClient) {}

  async listConversations(query: ListConversationsInput, auth: RequestAuth | null) {
    const actor = await upsertUserFromAuth(this.prisma, auth);
    const allowAdmin = hasAdminAccess(auth);

    const where: Record<string, unknown> = {};

    if (query.listingId) where.listingId = query.listingId;
    if (query.reservationId) where.reservationId = query.reservationId;

    if (query.guestTempId) {
      where.guestTempId = query.guestTempId;
    } else if (actor && !allowAdmin) {
      where.OR = [
        { hostUserId: actor.id },
        {
          listing: {
            ownerId: actor.id,
          },
        },
      ];
    }

    return this.prisma.conversation.findMany({
      where,
      include: {
        messages: {
          orderBy: {
            sentAt: 'asc',
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  async createConversation(input: CreateConversationInput, auth: RequestAuth | null) {
    const actor = await upsertUserFromAuth(this.prisma, auth);

    const listing = await this.prisma.listing.findUnique({
      where: { id: input.listingId },
      select: { id: true, ownerId: true },
    });

    if (!listing) return null;

    const hostUserId = actor?.id ?? listing.ownerId ?? null;

    const existing = await this.prisma.conversation.findFirst({
      where: {
        listingId: input.listingId,
        reservationId: input.reservationId ?? null,
        guestTempId: input.guestTempId ?? null,
      },
    });

    if (existing) return existing;

    return this.prisma.conversation.create({
      data: {
        listingId: input.listingId,
        reservationId: input.reservationId ?? null,
        hostUserId,
        guestUserId: input.guestUserId ?? null,
        guestTempId: input.guestTempId ?? null,
        subject: input.subject ?? null,
      },
    });
  }

  async listMessages(conversationId: string, auth: RequestAuth | null, guestTempId?: string) {
    const actor = await upsertUserFromAuth(this.prisma, auth);
    const allowAdmin = hasAdminAccess(auth);
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) return null;

    const authorizedAsGuest = Boolean(guestTempId && conversation.guestTempId === guestTempId);
    const authorizedAsHost = Boolean(
      allowAdmin
      || (actor && (conversation.hostUserId === actor.id || conversation.guestUserId === actor.id)),
    );

    if (!authorizedAsGuest && !authorizedAsHost) {
      return 'forbidden' as const;
    }

    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { sentAt: 'asc' },
    });
  }

  async sendMessage(conversationId: string, input: SendMessageInput, auth: RequestAuth | null) {
    const actor = await upsertUserFromAuth(this.prisma, auth);
    const allowAdmin = hasAdminAccess(auth);

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) return null;

    const isHostActor = Boolean(
      allowAdmin
      || (actor && (conversation.hostUserId === actor.id || conversation.guestUserId === actor.id)),
    );
    const isGuestActor = Boolean(input.guestTempId && conversation.guestTempId === input.guestTempId);

    if (!isHostActor && !isGuestActor) {
      return 'forbidden' as const;
    }

    const authorRole = input.author ?? (isHostActor ? 'host' : 'guest');

    const message = await this.prisma.message.create({
      data: {
        id: buildMessageId(conversationId),
        conversationId,
        listingId: conversation.listingId,
        reservationId: conversation.reservationId,
        authorRole,
        authorUserId: actor?.id ?? null,
        guestTempId: isGuestActor ? conversation.guestTempId : null,
        body: input.body,
        state: input.state ?? 'sent',
        sentAt: new Date(),
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async markMessageRead(messageId: string, auth: RequestAuth | null, guestTempId?: string) {
    const actor = await upsertUserFromAuth(this.prisma, auth);
    const allowAdmin = hasAdminAccess(auth);

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        conversation: true,
      },
    });

    if (!message) return null;

    const isHostActor = Boolean(allowAdmin || (actor && message.conversation.hostUserId === actor.id));
    const isGuestActor = Boolean(guestTempId && message.conversation.guestTempId === guestTempId);

    if (!isHostActor && !isGuestActor) {
      return 'forbidden' as const;
    }

    return this.prisma.message.update({
      where: { id: messageId },
      data: {
        state: 'read',
      },
    });
  }
}
