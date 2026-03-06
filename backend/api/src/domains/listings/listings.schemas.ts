import { z } from 'zod';

import { LISTING_RESOURCES } from './listings.constants.js';

const rawJsonSchema = z.record(z.any());

export const listingResourceParamsSchema = z.object({
  resource: z.enum(LISTING_RESOURCES),
  listingId: z.string().min(1),
});

export const createListingSchema = z.object({
  core: rawJsonSchema.optional(),
  bookings: rawJsonSchema.optional(),
  medias: rawJsonSchema.optional(),
  arrival: rawJsonSchema.optional(),
  notes: rawJsonSchema.optional(),
  comments: rawJsonSchema.optional(),
  host: rawJsonSchema.optional(),
});

export const patchListingResourceSchema = rawJsonSchema;

export type CreateListingInput = z.infer<typeof createListingSchema>;
