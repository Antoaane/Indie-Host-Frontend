import fp from 'fastify-plugin';

import { asObject } from '../../lib/json.js';
import { mediaListingParamsSchema, patchMediaSchema } from './medias.schemas.js';
import { MediasService } from './medias.service.js';

export const mediasPlugin = fp(async (fastify) => {
  const service = new MediasService(fastify.prisma);

  fastify.get('/medias/listings/:listingId', async (request, reply) => {
    const { listingId } = mediaListingParamsSchema.parse(request.params);
    const medias = await service.getListingMedias(listingId);

    if (!medias) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    reply.send(medias);
  });

  fastify.patch('/medias/listings/:listingId', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const { listingId } = mediaListingParamsSchema.parse(request.params);
    const patch = patchMediaSchema.parse(asObject(request.body));

    const medias = await service.patchListingMedias(listingId, patch);

    if (!medias) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    reply.send(medias);
  });
});
