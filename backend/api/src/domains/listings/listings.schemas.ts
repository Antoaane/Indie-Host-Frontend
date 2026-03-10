import { z } from 'zod';

import { LISTING_RESOURCES } from './listings.constants.js';

const rawJsonSchema = z.record(z.any());
const nullableRawJsonSchema = rawJsonSchema.nullable();
const subdomainSlugSchema = z.string().trim().toLowerCase()
  .min(3)
  .max(63)
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/, 'Invalid subdomain slug.');

export const listingResourceParamsSchema = z.object({
  resource: z.enum(LISTING_RESOURCES),
  listingId: z.string().min(1),
});

export const listingIdParamsSchema = z.object({
  listingId: z.string().trim().min(1),
});

export const listingDomainAvailabilitySchema = z.object({
  slug: subdomainSlugSchema,
  excludeListingId: z.string().trim().min(1).optional(),
});

export const upsertListingDomainSchema = z.object({
  slug: subdomainSlugSchema,
});

export const resolveListingHostnameSchema = z.object({
  hostname: z.string().trim().min(1),
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
export type ListingDomainAvailabilityInput = z.infer<typeof listingDomainAvailabilitySchema>;
export type UpsertListingDomainInput = z.infer<typeof upsertListingDomainSchema>;
