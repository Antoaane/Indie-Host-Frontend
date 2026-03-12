import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { createRemoteJWKSet, jwtVerify } from 'jose';

import { env } from '../config/env.js';
import type { RequestAuth } from '../types/auth.js';

function resolveBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;

  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token?.trim()) return null;
  return token.trim();
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const encodedPayload = token.split('.')[1];
  if (!encodedPayload) return null;

  try {
    const normalized = encodedPayload
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(encodedPayload.length / 4) * 4, '=');

    const decoded = Buffer.from(normalized, 'base64').toString('utf8');
    const payload = JSON.parse(decoded);

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

function buildAuthFromPayload(payload: Record<string, unknown>): RequestAuth | null {
  const userId = typeof payload.sub === 'string' ? payload.sub.trim() : '';
  if (!userId) return null;
  return { userId, payload };
}

function readDevAuthFallback(token: string): RequestAuth | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  return buildAuthFromPayload(payload);
}

let jwksResolver: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwksResolver() {
  if (jwksResolver) return jwksResolver;
  if (!env.CLERK_JWKS_URL) return null;

  jwksResolver = createRemoteJWKSet(new URL(env.CLERK_JWKS_URL));
  return jwksResolver;
}

async function verifyToken(request: FastifyRequest): Promise<RequestAuth | null> {
  const token = resolveBearerToken(request);
  if (!token) return null;

  const jwks = getJwksResolver();
  if ((!jwks || !env.CLERK_ISSUER) && env.NODE_ENV === 'development') {
    return readDevAuthFallback(token);
  }

  if (!jwks || !env.CLERK_ISSUER) {
    throw new Error('Clerk JWT validation is not configured (CLERK_JWKS_URL / CLERK_ISSUER).');
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: env.CLERK_ISSUER,
      audience: env.CLERK_AUDIENCE.length ? env.CLERK_AUDIENCE : undefined,
    });

    const auth = buildAuthFromPayload(payload as Record<string, unknown>);
    if (!auth) {
      throw new Error('Invalid Clerk JWT: missing subject claim.');
    }

    return auth;
  } catch (error) {
    if (env.NODE_ENV === 'development') {
      const fallbackAuth = readDevAuthFallback(token);
      if (fallbackAuth) {
        request.log.warn({ err: error }, 'JWT verification failed, using development fallback auth.');
        return fallbackAuth;
      }
    }

    throw error;
  }
}

async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const auth = await verifyToken(request);

    if (!auth) {
      reply.code(401).send({ message: 'Authentication required.' });
      return;
    }

    request.auth = auth;
  } catch (error) {
    request.log.warn({ err: error }, 'JWT verification failed');
    reply.code(401).send({ message: 'Invalid authentication token.' });
  }
}

async function authenticateOptional(request: FastifyRequest) {
  try {
    request.auth = await verifyToken(request);
  } catch {
    request.auth = null;
  }
}

export const authPlugin = fp(async (fastify) => {
  fastify.decorateRequest('auth', null);
  fastify.decorate('authenticate', authenticate);
  fastify.decorate('authenticateOptional', authenticateOptional);
});
