import fp from 'fastify-plugin';

import { asObject } from '../../lib/json.js';
import { userIdParamsSchema, updateMeSchema } from './users.schemas.js';
import { UsersService } from './users.service.js';

export const usersPlugin = fp(async (fastify) => {
  const service = new UsersService(fastify.prisma);

  fastify.get('/user/:userId/listings', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const { userId } = userIdParamsSchema.parse(request.params);
    const listings = await service.listUserListingsForAuth(userId, request.auth);
    if (listings === 'forbidden') {
      reply.code(403).send({ message: 'You cannot access listings for this user.' });
      return;
    }
    reply.send(listings);
  });

  fastify.get('/users/me/listings', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const listings = await service.listAuthenticatedUserListings(request.auth);
    reply.send(listings);
  });

  fastify.get('/users/me', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const user = await service.getOrCreateAuthenticatedUser(request.auth);
    if (!user) {
      reply.code(401).send({ message: 'Authentication required.' });
      return;
    }

    reply.send(user);
  });

  fastify.patch('/users/me', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const payload = updateMeSchema.parse(asObject(request.body));
    const user = await service.updateAuthenticatedUser(request.auth, payload);

    if (!user) {
      reply.code(401).send({ message: 'Authentication required.' });
      return;
    }

    reply.send(user);
  });
});
