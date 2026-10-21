import fp from 'fastify-plugin';

import { env } from '../../config/env.js';
import { hasAdminAccess, readRoleFromAuthPayload } from '../../lib/authRole.js';
import { asObject } from '../../lib/json.js';
import type { RequestAuth } from '../../types/auth.js';
import { ClerkApiError } from '../../lib/clerkUsers.js';
import { adminInvitationSchema, adminUserSearchQuerySchema, userIdParamsSchema, updateMeSchema } from './users.schemas.js';
import { UsersService } from './users.service.js';

function decodeBearerPayload(authorizationHeader: string | string[] | undefined): Record<string, unknown> | null {
  if (!authorizationHeader) return null;
  const header = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader;
  if (typeof header !== 'string' || !header.trim()) return null;

  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token?.trim()) return null;

  const encodedPayload = token.trim().split('.')[1];
  if (!encodedPayload) return null;

  try {
    const normalized = encodedPayload
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(encodedPayload.length / 4) * 4, '=');

    const payload = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

function resolveAuth(requestAuth: RequestAuth | null, authorizationHeader: string | string[] | undefined): RequestAuth | null {
  if (requestAuth) return requestAuth;
  if (env.NODE_ENV !== 'development') return null;

  const payload = decodeBearerPayload(authorizationHeader);
  const subject = typeof payload?.sub === 'string' ? payload.sub.trim() : '';
  if (!subject) return null;

  return {
    userId: subject,
    payload: payload as RequestAuth['payload'],
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

    reply.send({
      ...user,
      isAdmin: hasAdminAccess(auth),
      authRole: readRoleFromAuthPayload(auth.payload),
    });
  });

  fastify.get('/users/admin/search', {
    preHandler: fastify.authenticateOptional,
  }, async (request, reply) => {
    const auth = resolveAuth(request.auth, request.headers.authorization);
    if (!auth) {
      reply.code(401).send({ message: 'Authentication required.' });
      return;
    }

    const query = adminUserSearchQuerySchema.parse(request.query);
    const users = await service.searchUsersForAdmin(query, auth);
    if (users === 'forbidden') {
      reply.code(403).send({ message: 'Admin access required.' });
      return;
    }

    reply.send({ users });
  });

  fastify.get('/users/admin/overview', {
    preHandler: fastify.authenticateOptional,
  }, async (request, reply) => {
    const auth = resolveAuth(request.auth, request.headers.authorization);
    if (!auth) {
      reply.code(401).send({ message: 'Authentication required.' });
      return;
    }

    const query = adminUserSearchQuerySchema.parse(request.query);
    const users = await service.listUsersOverviewForAdmin(query, auth);
    if (users === 'forbidden') {
      reply.code(403).send({ message: 'Admin access required.' });
      return;
    }

    reply.send({ users });
  });

  fastify.post('/users/admin/invitations', {
    preHandler: fastify.authenticateOptional,
  }, async (request, reply) => {
    const auth = resolveAuth(request.auth, request.headers.authorization);
    if (!auth) {
      reply.code(401).send({ message: 'Authentication required.' });
      return;
    }

    const payload = adminInvitationSchema.parse(asObject(request.body));
    try {
      const invitation = await service.createInvitationForAdmin(payload, auth);
      if (invitation === 'forbidden') {
        reply.code(403).send({ message: 'Admin access required.' });
        return;
      }
      reply.code(201).send(invitation);
    } catch (error) {
      if (error instanceof ClerkApiError) {
        reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ message: error.message });
        return;
      }
      throw error;
    }
  });

  fastify.get('/users/admin/listings', {
    preHandler: fastify.authenticateOptional,
  }, async (request, reply) => {
    const auth = resolveAuth(request.auth, request.headers.authorization);
    if (!auth) {
      reply.code(401).send({ message: 'Authentication required.' });
      return;
    }

    const listings = await service.listAllListingsForAdmin(auth);
    if (listings === 'forbidden') {
      reply.code(403).send({ message: 'Admin access required.' });
      return;
    }

    reply.send(listings);
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
