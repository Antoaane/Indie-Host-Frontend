import fp from 'fastify-plugin';

import { env } from '../../config/env.js';
import { asObject } from '../../lib/json.js';
import type { RequestAuth } from '../../types/auth.js';
import { userIdParamsSchema, updateMeSchema } from './users.schemas.js';
import { UsersService } from './users.service.js';

function decodeBearerSubject(authorizationHeader: string | string[] | undefined): string | null {
  if (!authorizationHeader) return null;
  const header = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader;
  if (!header) return null;

  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token?.trim()) return null;

  const encodedPayload = token.trim().split('.')[1];
  if (!encodedPayload) return null;

  try {
    const normalized = encodedPayload
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(encodedPayload.length / 4) * 4, '=');

    const payload = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8')) as { sub?: unknown };
    const subject = typeof payload.sub === 'string' ? payload.sub.trim() : '';
    return subject || null;
  } catch {
    return null;
  }
}

function resolveAuth(requestAuth: RequestAuth | null, authorizationHeader: string | string[] | undefined): RequestAuth | null {
  if (requestAuth) return requestAuth;
  if (env.NODE_ENV !== 'development') return null;

  const subject = decodeBearerSubject(authorizationHeader);
  if (!subject) return null;

  return {
    userId: subject,
    payload: { sub: subject },
  };
}

export const usersPlugin = fp(async (fastify) => {
  const service = new UsersService(fastify.prisma);

  fastify.get('/user/:userId/listings', {
    preHandler: fastify.authenticateOptional,
  }, async (request, reply) => {
    const auth = resolveAuth(request.auth, request.headers.authorization);
    if (!auth) {
      reply.code(401).send({ message: 'Authentication required.' });
      return;
    }

    const { userId } = userIdParamsSchema.parse(request.params);
    const listings = await service.listUserListingsForAuth(userId, auth);
    if (listings === 'forbidden') {
      reply.code(403).send({ message: 'You cannot access listings for this user.' });
      return;
    }
    reply.send(listings);
  });

  fastify.get('/users/me/listings', {
    preHandler: fastify.authenticateOptional,
  }, async (request, reply) => {
    const auth = resolveAuth(request.auth, request.headers.authorization);
    if (!auth) {
      reply.code(401).send({ message: 'Authentication required.' });
      return;
    }

    const listings = await service.listAuthenticatedUserListings(auth);
    reply.send(listings);
  });

  // Backward-compatible alias for legacy clients.
  fastify.get('/user/me/listings', {
    preHandler: fastify.authenticateOptional,
  }, async (request, reply) => {
    const auth = resolveAuth(request.auth, request.headers.authorization);
    if (!auth) {
      reply.code(401).send({ message: 'Authentication required.' });
      return;
    }

    const listings = await service.listAuthenticatedUserListings(auth);
    reply.send(listings);
  });

  fastify.get('/users/me', {
    preHandler: fastify.authenticateOptional,
  }, async (request, reply) => {
    const auth = resolveAuth(request.auth, request.headers.authorization);
    if (!auth) {
      reply.code(401).send({ message: 'Authentication required.' });
      return;
    }

    const user = await service.getOrCreateAuthenticatedUser(auth);
    if (!user) {
      reply.code(401).send({ message: 'Authentication required.' });
      return;
    }

    reply.send(user);
  });

  fastify.patch('/users/me', {
    preHandler: fastify.authenticateOptional,
  }, async (request, reply) => {
    const auth = resolveAuth(request.auth, request.headers.authorization);
    if (!auth) {
      reply.code(401).send({ message: 'Authentication required.' });
      return;
    }

    const payload = updateMeSchema.parse(asObject(request.body));
    const user = await service.updateAuthenticatedUser(auth, payload);

    if (!user) {
      reply.code(401).send({ message: 'Authentication required.' });
      return;
    }

    reply.send(user);
  });
});
