import { z } from 'zod';

const guestsSchema = z.object({
  adults: z.coerce.number().int().min(0).default(0),
  children: z.coerce.number().int().min(0).default(0),
  infants: z.coerce.number().int().min(0).default(0),
  pets: z.coerce.number().int().min(0).default(0),
  pmr: z.coerce.number().int().min(0).optional(),
});

const paymentSchema = z.object({
  total: z.coerce.number().nonnegative().default(0),
  deposit: z.coerce.number().nonnegative().default(0),
  balance: z.coerce.number().nonnegative().default(0),
  status: z.string().trim().min(1).default('pending'),
  method: z.string().trim().min(1).default('Carte'),
  manual: z.record(z.any()).optional(),
  stripe: z.record(z.any()).optional(),
});

export const listingBookingsParamsSchema = z.object({
  listingId: z.string().min(1),
});

export const createBookingSchema = z.object({
  id: z.string().trim().min(1).optional(),
  listingId: z.string().trim().min(1),
  start: z.string().trim().min(1),
  end: z.string().trim().min(1),
  nights: z.coerce.number().int().positive(),
  guestName: z.string().trim().min(1),
  guestAvatar: z.string().trim().optional(),
  message: z.string().default(''),
  internalNote: z.string().optional(),
  guests: guestsSchema,
  payment: paymentSchema,
  contact: z.record(z.any()).optional(),
  createdAt: z.string().optional(),
  messaging: z.record(z.any()).optional(),
});

export const updateBookingParamsSchema = z.object({
  reservationId: z.string().min(1),
});

export const updateBookingSchema = z.object({
  listingId: z.string().trim().min(1),
  patch: z.record(z.any()),
});

export const bookingConfirmationParamsSchema = z.object({
  reservationId: z.string().trim().min(1),
});

export const bookingAccessQuerySchema = z.object({
  token: z.string().trim().min(1),
});

export const cancelBookingSchema = z.object({
  token: z.string().trim().min(1),
  reason: z.string().trim().max(1000).optional(),
});

export const hostCancelBookingSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
});

export const bookingGuideParamsSchema = z.object({
  guideKey: z.string().trim().min(1),
});

export const bookingGuideMessageSchema = z.object({
  body: z.string().trim().min(1),
});
