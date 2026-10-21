import fp from 'fastify-plugin';

import { asObject } from '../../lib/json.js';
import {
  createConnectDashboardLinkSchema,
  activateSubscriptionSchema,
  confirmCheckoutSessionSchema,
  createConnectOnboardingLinkSchema,
  createPaymentIntentSchema,
  adminComplimentaryPlanSchema,
  adminSubscriptionLinkSchema,
  adminUserParamsSchema,
  getMySubscriptionQuerySchema,
  syncConnectStateSchema,
  updateExtraListingsSchema,
} from './payments.schemas.js';
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

  fastify.post('/payments/stripe/connect/dashboard-link', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const payload = createConnectDashboardLinkSchema.parse(asObject(request.body));
    const result = await service.createConnectDashboardLink(payload, request.auth);

    if (!result) {
      reply.code(401).send({ message: 'Authentication required.' });
      return;
    }

    reply.send(result);
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

  fastify.post('/payments/stripe/connect/sync', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const payload = syncConnectStateSchema.parse(asObject(request.body));
    const result = await service.syncMyStripeConnectState(payload, request.auth);

    if (!result) {
      reply.code(401).send({ message: 'Authentication required.' });
      return;
    }

    reply.send(result);
  });

  fastify.get('/payments/stripe/subscriptions/plans', async (_request, reply) => {
    const plans = await service.listSubscriptionPlans();
    reply.send({ plans });
  });

  // Catalogue public : plans + offre « logement supplémentaire » (landing et page Tarifs).
  fastify.get('/payments/stripe/subscriptions/catalog', async (_request, reply) => {
    reply.send(await service.getSubscriptionCatalog());
  });

  // Fenêtre admin : abonnement d'un client, ses logements supplémentaires, lien de paiement à lui envoyer.
  fastify.get('/payments/stripe/admin/users/:userId/subscription', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const params = adminUserParamsSchema.parse(request.params);
    const query = getMySubscriptionQuerySchema.parse(asObject(request.query));
    const result = await service.getSubscriptionStateForUserAsAdmin(request.auth, params.userId, query);

    if (result === 'forbidden') {
      reply.code(403).send({ message: 'Admin access required.' });
      return;
    }

    if (!result) {
      reply.code(404).send({ message: 'User not found.' });
      return;
    }

    reply.send(result);
  });

  fastify.post('/payments/stripe/admin/users/:userId/extra-listings', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const params = adminUserParamsSchema.parse(request.params);
    const payload = updateExtraListingsSchema.parse(asObject(request.body));
    const result = await service.updateExtraListingsForUserAsAdmin(request.auth, params.userId, payload.quantity);

    if (result === 'forbidden') {
      reply.code(403).send({ message: 'Admin access required.' });
      return;
    }

    if (!result) {
      reply.code(404).send({ message: 'User not found.' });
      return;
    }

    if (result.state !== 'updated') {
      reply.code(409).send({ message: result.message, details: result });
      return;
    }

    reply.send(result);
  });

  fastify.post('/payments/stripe/admin/users/:userId/complimentary-plan', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const params = adminUserParamsSchema.parse(request.params);
    const payload = adminComplimentaryPlanSchema.parse(asObject(request.body));
    const result = await service.grantComplimentaryPlanForUserAsAdmin(request.auth, params.userId, {
      planCode: payload.planCode,
      extraListings: payload.extraListings,
      endsAtISO: payload.endsAtISO ?? null,
    });

    if (result === 'forbidden') {
      reply.code(403).send({ message: 'Admin access required.' });
      return;
    }

    if (!result) {
      reply.code(404).send({ message: 'User not found.' });
      return;
    }

    if (result.state !== 'granted') {
      reply.code(409).send({ message: result.message, details: result });
      return;
    }

    reply.send(result);
  });

  fastify.delete('/payments/stripe/admin/users/:userId/complimentary-plan', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const params = adminUserParamsSchema.parse(request.params);
    const result = await service.revokeComplimentaryPlanForUserAsAdmin(request.auth, params.userId);

    if (result === 'forbidden') {
      reply.code(403).send({ message: 'Admin access required.' });
      return;
    }

    if (!result) {
      reply.code(404).send({ message: 'User not found.' });
      return;
    }

    reply.send(result);
  });

  fastify.post('/payments/stripe/admin/subscription-links', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const payload = adminSubscriptionLinkSchema.parse(asObject(request.body));
    const result = await service.createSubscriptionLinkForUserAsAdmin(request.auth, payload);

    if (result === 'forbidden') {
      reply.code(403).send({ message: 'Admin access required.' });
      return;
    }

    if (!result) {
      reply.code(404).send({ message: 'User not found.' });
      return;
    }

    if (result.state === 'plan_unavailable') {
      reply.code(400).send({ message: result.message, details: result });
      return;
    }

    reply.code(201).send(result);
  });

  fastify.get('/payments/stripe/subscriptions/me', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const query = getMySubscriptionQuerySchema.parse(asObject(request.query));
    const result = await service.getMySubscriptionState(request.auth, query);

    if (!result) {
      reply.code(401).send({ message: 'Authentication required.' });
      return;
    }

    reply.send(result);
  });

  fastify.post('/payments/stripe/subscriptions/extra-listings', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const payload = updateExtraListingsSchema.parse(asObject(request.body));
    const result = await service.updateExtraListings(payload, request.auth);

    if (!result) {
      reply.code(401).send({ message: 'Authentication required.' });
      return;
    }

    if (result.state !== 'updated') {
      reply.code(409).send({ message: result.message, details: result });
      return;
    }

    reply.send(result);
  });

  fastify.post('/payments/stripe/subscriptions/activate', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const payload = activateSubscriptionSchema.parse(asObject(request.body));
    const result = await service.activateSubscription(payload, request.auth);

    if (!result) {
      reply.code(401).send({ message: 'Authentication required.' });
      return;
    }

    if (result.state === 'plan_unavailable') {
      reply.code(400).send({
        message: result.message ?? 'Selected plan is unavailable.',
        details: result,
      });
      return;
    }

    if (result.state === 'checkout_required') {
      reply.code(201).send(result);
      return;
    }

    reply.send(result);
  });

  fastify.post('/payments/stripe/subscriptions/checkout/confirm', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const payload = confirmCheckoutSessionSchema.parse(asObject(request.body));
    const result = await service.confirmSubscriptionCheckout(payload, request.auth);

    if (!result) {
      reply.code(401).send({ message: 'Authentication required.' });
      return;
    }

    if (result.state === 'not_found') {
      reply.code(404).send({
        message: result.message ?? 'Checkout session not found.',
        details: result,
      });
      return;
    }

    reply.send(result);
  });
});
