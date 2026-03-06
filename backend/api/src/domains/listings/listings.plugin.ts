import fp from 'fastify-plugin';
import { z } from 'zod';

import { asObject } from '../../lib/json.js';
import { ListingsService } from './listings.service.js';
import { createListingSchema, listingResourceParamsSchema, patchListingResourceSchema } from './listings.schemas.js';

const listingBundleParamsSchema = z.object({
  listingId: z.string().min(1),
});

export const listingsPlugin = fp(async (fastify) => {
  const service = new ListingsService(fastify.prisma);

  fastify.get('/listings/:resource/:listingId', async (request, reply) => {
    const params = listingResourceParamsSchema.parse(request.params);
    const resource = await service.getListingResource(params.resource, params.listingId);

    if (!resource) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    reply.send(resource);
  });

  fastify.patch('/listings/:resource/:listingId', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const params = listingResourceParamsSchema.parse(request.params);
    const patch = patchListingResourceSchema.parse(asObject(request.body));

    const updated = await service.patchListingResource({
      listingId: params.listingId,
      resource: params.resource,
      patch,
      auth: request.auth,
    });

    if (!updated) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    if (updated === 'forbidden') {
      reply.code(403).send({ message: 'You cannot edit this listing.' });
      return;
    }

    reply.send(updated);
  });

  fastify.post('/listings', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const payload = createListingSchema.parse(asObject(request.body));
    const created = await service.createListing(payload, request.auth);
    reply.code(201).send(created);
  });

  fastify.get('/listings/bundle/:listingId', async (request, reply) => {
    const params = listingBundleParamsSchema.parse(request.params);
    const bundle = await service.getListingBundle(params.listingId);

    if (!bundle) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    reply.send(bundle);
  });
});
