import { z } from 'zod';

const isoDaySchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);

// proxy_url du microservice n'est volontairement pas exposé : il permettait de joindre
// n'importe quel hôte depuis le serveur.
export const scrapeListingSchema = z.object({
  url: z.string().trim().min(1).max(2048),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/).optional().default('EUR'),
  check_in: z.union([isoDaySchema, z.literal('')]).optional().default(''),
  check_out: z.union([isoDaySchema, z.literal('')]).optional().default(''),
});

export type ScrapeListingInput = z.infer<typeof scrapeListingSchema>;
