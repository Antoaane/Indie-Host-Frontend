import fp from 'fastify-plugin';

import { asObject } from '../../lib/json.js';
import { rateLimitByIp } from '../../lib/rateLimit.js';
import { scrapeListingSchema } from './imports.schemas.js';
import { ImportsService } from './imports.service.js';

// Import d'annonce Airbnb / Booking : relais vers le microservice de scraping, qui n'est plus
// exposé publiquement. Route publique (l'import est proposé sur la landing sans compte).
export const importsPlugin = fp(async (fastify) => {
  const service = new ImportsService();

  fastify.post('/imports/scrape', {
    preHandler: rateLimitByIp({
      max: 6,
      windowMs: 10 * 60 * 1000,
      message: "Trop d'imports à la suite. Réessayez dans quelques minutes.",
    }),
  }, async (request, reply) => {
    const payload = scrapeListingSchema.parse(asObject(request.body));

    try {
      const listing = await service.scrapeListing(payload);
      reply.send(listing);
    } catch (error) {
      // Messages rédigés pour l'utilisateur, y compris en 502/503 (que le gestionnaire global
      // remplacerait par un message générique).
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (!statusCode || !(error instanceof Error)) throw error;
      reply.code(statusCode).send({ message: error.message });
    }
  });
});
