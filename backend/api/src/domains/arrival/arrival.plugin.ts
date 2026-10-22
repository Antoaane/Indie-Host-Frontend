import fp from 'fastify-plugin';

import { asObject } from '../../lib/json.js';
import { isRedactedPatch, redactArrivalForPublic, resolveListingAccess } from '../listings/listings.access.js';
import { arrivalListingParamsSchema, patchArrivalSchema } from './arrival.schemas.js';
import { ArrivalService } from './arrival.service.js';

export const arrivalPlugin = fp(async (fastify) => {
  const service = new ArrivalService(fastify.prisma);

  fastify.get('/arrival/listings/:listingId', {
    preHandler: fastify.authenticateOptional,
  }, async (request, reply) => {
    const { listingId } = arrivalListingParamsSchema.parse(request.params);
    const arrival = await service.getListingArrival(listingId);

    if (!arrival) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    // Adresse, accès et Wi-Fi : réservés à l'hôte, le voyageur les reçoit par sa clé de guide.
    const access = await resolveListingAccess(fastify.prisma, listingId, request.auth);
    reply.send(access?.canReadPrivate ? arrival : redactArrivalForPublic(arrival));
  });

  fastify.patch('/arrival/listings/:listingId', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const { listingId } = arrivalListingParamsSchema.parse(request.params);
    const patch = patchArrivalSchema.parse(asObject(request.body));

    const access = await resolveListingAccess(fastify.prisma, listingId, request.auth);
    if (!access) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    if (!access.canWrite) {
      reply.code(403).send({ message: 'You cannot edit this listing.' });
      return;
    }

    if (isRedactedPatch(patch)) {
      reply.code(409).send({ message: 'Votre session a expiré : rechargez la page avant d’enregistrer.' });
      return;
    }

    const arrival = await service.patchListingArrival(listingId, patch);

    if (!arrival) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    reply.send(arrival);
  });
});
