import { z } from 'zod';

const isoDateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);
const paymentChoiceSchema = z.enum([
  'full',
  'split',
  'cash',
]);
const deferredModeSchema = z.enum([
  'none',
  'online',
  'cash',
]);

const reservationSchema = z.object({
  startISO: isoDateSchema.optional(),
  endISO: isoDateSchema.optional(),
  nights: z.coerce.number().int().positive().optional(),
  total: z.coerce.number().nonnegative().optional(),
  occupants: z.object({
    adults: z.coerce.number().int().nonnegative().optional(),
    children: z.coerce.number().int().nonnegative().optional(),
    babies: z.coerce.number().int().nonnegative().optional(),
    animals: z.coerce.number().int().nonnegative().optional(),
    pmr: z.coerce.number().int().nonnegative().optional(),
  }).optional(),
  fees: z.array(z.record(z.any())).optional(),
  pricing: z.record(z.any()).optional(),
});

const paymentSchema = z.object({
  choice: paymentChoiceSchema,
  totalAmount: z.coerce.number().nonnegative(),
  chargeNowAmount: z.coerce.number().positive(),
  deferredAmount: z.coerce.number().nonnegative().optional(),
  deferredMode: deferredModeSchema.optional(),
  deferredDueDateISO: isoDateSchema.nullable().optional(),
});

export const createPaymentIntentSchema = z.object({
  listingId: z.string().trim().min(1),
  connectedAccountId: z.string().trim().optional().default(''),
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

export const syncConnectStateSchema = z.object({
  accountId: z.string().trim().optional(),
});

export const subscriptionPlanCodeSchema = z.enum([
  'indiehost',
  'superhost',
  'megahost',
]);

export const activateSubscriptionSchema = z.object({
  planCode: subscriptionPlanCodeSchema,
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export const confirmCheckoutSessionSchema = z.object({
  sessionId: z.string().trim().min(1),
  planCode: subscriptionPlanCodeSchema.optional(),
});

const queryBooleanSchema = z.preprocess((value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off', ''].includes(normalized)) return false;
  }

  return value;
}, z.boolean().default(false));

export const getMySubscriptionQuerySchema = z.object({
  sync: queryBooleanSchema.optional().default(false),
});
