import { z } from 'zod';

export const userIdParamsSchema = z.object({
  userId: z.string().min(1),
});

export const adminUserSearchQuerySchema = z.object({
  query: z.string().trim().max(200).optional().default(''),
  limit: z.coerce.number().int().min(1).max(2000).optional().default(2000),
});

export const updateMeSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().trim().min(1).max(120).optional(),
  lastName: z.string().trim().min(1).max(120).optional(),
  displayName: z.string().trim().min(1).max(120).optional(),
  avatarUrl: z.string().url().optional(),
  hostProfile: z.record(z.any()).optional(),
  stripeConnect: z.record(z.any()).optional(),
});
