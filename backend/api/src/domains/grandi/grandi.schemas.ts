import { z } from 'zod';

export const checkDomainAvailabilitySchema = z.object({
  domain: z.string().trim().min(3).max(253),
  currency: z.string().trim().length(3).optional().default('EUR'),
});

export const createDomainCheckoutSchema = z.object({
  domain: z.string().trim().min(3).max(253),
  userId: z.string().trim().optional(),
  customerEmail: z.string().trim().email().optional(),
  successUrl: z.string().trim().url().optional(),
  cancelUrl: z.string().trim().url().optional(),
});
