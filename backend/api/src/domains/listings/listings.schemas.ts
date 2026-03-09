import { z } from 'zod';

import { LISTING_RESOURCES } from './listings.constants.js';

const rawJsonSchema = z.record(z.any());
const nullableRawJsonSchema = rawJsonSchema.nullable();

export const listingResourceParamsSchema = z.object({
  resource: z.enum(LISTING_RESOURCES),
  listingId: z.string().min(1),
});

export const createListingSchema = z.object({
  core: nullableRawJsonSchema.optional(),
  bookings: nullableRawJsonSchema.optional(),
  medias: nullableRawJsonSchema.optional(),
  arrival: nullableRawJsonSchema.optional(),
  notes: nullableRawJsonSchema.optional(),
  comments: nullableRawJsonSchema.optional(),
  host: nullableRawJsonSchema.optional(),
});

export const patchListingResourceSchema = rawJsonSchema;

export type CreateListingInput = z.infer<typeof createListingSchema>;
