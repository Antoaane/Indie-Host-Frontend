import fp from 'fastify-plugin';

import { asObject } from '../../lib/json.js';
import { checkDomainAvailabilitySchema, createDomainCheckoutSchema } from './grandi.schemas.js';
import { GrandiService } from './grandi.service.js';

export const grandiPlugin = fp(async (fastify) => {
  const service = new GrandiService();

  /**
   * GET /domains/grandi/availability?domain=<name>&currency=EUR
   * Vérifie la disponibilité d'un domaine via l'API Gandi v5.
   */
  fastify.get('/domains/grandi/availability', {
    preHandler: fastify.authenticateOptional,
  }, async (request, reply) => {
    const query = checkDomainAvailabilitySchema.parse(asObject(request.query));
    const result = await service.checkAvailability(query.domain, query.currency);
    reply.send(result);
  });

  /**
   * POST /domains/grandi/checkout
   * Retourne une URL de paiement Gandi pour le domaine demandé.
   */
  fastify.post('/domains/grandi/checkout', {
    preHandler: fastify.authenticateOptional,
  }, async (request, reply) => {
    const payload = createDomainCheckoutSchema.parse(asObject(request.body));
    const session = await service.createCheckoutSession(payload.domain, {
      userId: payload.userId,
      customerEmail: payload.customerEmail,
      successUrl: payload.successUrl,
      cancelUrl: payload.cancelUrl,
    });
    reply.code(201).send(session);
  });
});
