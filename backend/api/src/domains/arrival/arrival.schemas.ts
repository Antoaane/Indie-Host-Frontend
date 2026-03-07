import { z } from 'zod';

export const arrivalListingParamsSchema = z.object({
  listingId: z.string().min(1),
});

export const patchArrivalSchema = z.record(z.any());
