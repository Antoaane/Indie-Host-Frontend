import fp from 'fastify-plugin';

import { asObject } from '../../lib/json.js';
import { arrivalListingParamsSchema, patchArrivalSchema } from './arrival.schemas.js';
import { ArrivalService } from './arrival.service.js';

export const arrivalPlugin = fp(async (fastify) => {
  const service = new ArrivalService(fastify.prisma);

  fastify.get('/arrival/listings/:listingId', async (request, reply) => {
    const { listingId } = arrivalListingParamsSchema.parse(request.params);
    const arrival = await service.getListingArrival(listingId);

    if (!arrival) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    reply.send(arrival);
  });

  fastify.patch('/arrival/listings/:listingId', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const { listingId } = arrivalListingParamsSchema.parse(request.params);
    const patch = patchArrivalSchema.parse(asObject(request.body));

    const arrival = await service.patchListingArrival(listingId, patch);

    if (!arrival) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    reply.send(arrival);
  });
});
