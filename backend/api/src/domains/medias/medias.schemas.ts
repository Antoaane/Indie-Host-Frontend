import { z } from 'zod';

export const mediaListingParamsSchema = z.object({
  listingId: z.string().min(1),
});

export const patchMediaSchema = z.record(z.any());
