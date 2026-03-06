import { z } from 'zod';

export const calendarListingParamsSchema = z.object({
  listingId: z.string().min(1),
});

export const importCalendarSchema = z.object({
  name: z.string().trim().optional(),
  url: z.string().url().optional(),
  ical: z.string().trim().optional(),
  timezone: z.string().trim().optional(),
}).refine((input) => Boolean(input.url || input.ical), {
  message: 'Either url or ical must be provided.',
});

export const syncParamsSchema = z.object({
  listingId: z.string().min(1),
  syncId: z.string().min(1),
});
