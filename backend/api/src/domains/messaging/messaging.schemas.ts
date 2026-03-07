import { z } from 'zod';

export const listConversationsQuerySchema = z.object({
  listingId: z.string().trim().optional(),
  reservationId: z.string().trim().optional(),
  guestTempId: z.string().trim().optional(),
});

export const createConversationSchema = z.object({
  listingId: z.string().trim().min(1),
  reservationId: z.string().trim().optional(),
  guestTempId: z.string().trim().optional(),
  guestUserId: z.string().trim().optional(),
  subject: z.string().trim().optional(),
});

export const conversationParamsSchema = z.object({
  conversationId: z.string().min(1),
});

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1),
  author: z.enum(['host', 'guest', 'system']).optional(),
  state: z.enum(['sent', 'delivered', 'read']).optional(),
  guestTempId: z.string().trim().optional(),
});

export const markReadSchema = z.object({
  messageId: z.string().trim().min(1),
});
