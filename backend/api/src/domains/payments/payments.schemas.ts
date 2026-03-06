import { z } from 'zod';

const reservationSchema = z.object({
  startISO: z.string().optional(),
  endISO: z.string().optional(),
  nights: z.coerce.number().optional(),
  total: z.coerce.number().optional(),
  occupants: z.record(z.any()).optional(),
  fees: z.array(z.record(z.any())).optional(),
  pricing: z.record(z.any()).optional(),
});

const paymentSchema = z.object({
  choice: z.string().trim().min(1),
  totalAmount: z.coerce.number(),
  chargeNowAmount: z.coerce.number(),
  deferredAmount: z.coerce.number().optional(),
  deferredMode: z.string().trim().optional(),
  deferredDueDateISO: z.string().nullable().optional(),
});

export const createPaymentIntentSchema = z.object({
  listingId: z.string().trim().min(1),
  connectedAccountId: z.string().trim().min(1),
  currency: z.string().trim().default('eur'),
  reservation: reservationSchema,
  payment: paymentSchema,
  metadata: z.record(z.string()).optional(),
});

export const createConnectOnboardingLinkSchema = z.object({
  accountId: z.string().trim().optional(),
  refreshUrl: z.string().url(),
  returnUrl: z.string().url(),
  country: z.string().trim().length(2).optional().default('FR'),
});
