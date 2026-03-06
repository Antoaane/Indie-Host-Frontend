import fp from 'fastify-plugin';

import { asObject } from '../../lib/json.js';
import { createConnectOnboardingLinkSchema, createPaymentIntentSchema } from './payments.schemas.js';
import { PaymentsService } from './payments.service.js';

export const paymentsPlugin = fp(async (fastify) => {
  const service = new PaymentsService(fastify.prisma);

  fastify.post('/payments/stripe/payment-intents', {
    preHandler: fastify.authenticateOptional,
  }, async (request, reply) => {
    const payload = createPaymentIntentSchema.parse(asObject(request.body));
    const result = await service.createPaymentIntent(payload, request.auth);

    if (!result) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    reply.code(201).send(result);
  });

  fastify.post('/payments/stripe/connect/onboarding-link', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const payload = createConnectOnboardingLinkSchema.parse(asObject(request.body));
    const result = await service.createConnectOnboardingLink(payload, request.auth);

    if (!result) {
      reply.code(401).send({ message: 'Authentication required.' });
      return;
    }

    reply.code(201).send(result);
  });

  fastify.get('/payments/stripe/connect/me', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const result = await service.getMyStripeConnectProfile(request.auth);

    if (!result) {
      reply.code(401).send({ message: 'Authentication required.' });
      return;
    }

    reply.send(result);
  });
});
