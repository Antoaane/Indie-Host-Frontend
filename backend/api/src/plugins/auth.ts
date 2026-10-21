import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { createRemoteJWKSet, jwtVerify } from 'jose';

import { env } from '../config/env.js';
import { readRoleFromAuthPayload } from '../lib/authRole.js';
import type { RequestAuth } from '../types/auth.js';

const CLERK_API_BASE_URL = 'https://api.clerk.com/v1';
const CLERK_ROLE_CACHE_TTL_MS = 5 * 60 * 1000;

type ClerkRoleCacheEntry = {
  role: string | null;
  expiresAt: number;
};

const clerkRoleCache = new Map<string, ClerkRoleCacheEntry>();

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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function mergeRoleIntoPayload(payload: Record<string, unknown>, role: string | null): Record<string, unknown> {
  if (!role) return payload;

  const privateMetadata = asRecord(payload.private_metadata ?? payload.privateMetadata) ?? {};
  const nextPrivateMetadata = {
    ...privateMetadata,
    role,
  };

  return {
    ...payload,
    private_metadata: nextPrivateMetadata,
    privateMetadata: nextPrivateMetadata,
  };
}

const SUPER_ADMIN_EMAILS = new Set(
  env.SUPER_ADMIN_EMAILS
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

function isSuperAdminEmail(email: string | null): boolean {
  return Boolean(email) && SUPER_ADMIN_EMAILS.has((email as string).toLowerCase());
}

function readClerkPrimaryEmail(data: unknown): string | null {
  const record = asRecord(data);
  if (!record) return null;

  const addresses = Array.isArray(record.email_addresses) ? record.email_addresses : [];
  const primaryId = typeof record.primary_email_address_id === 'string' ? record.primary_email_address_id : null;

  for (const entry of addresses) {
    const address = asRecord(entry);
    if (!address) continue;
    const email = typeof address.email_address === 'string' ? address.email_address.trim() : '';
    if (!email) continue;
    if (!primaryId || address.id === primaryId) return email;
  }

  return null;
}

async function fetchClerkRole(userId: string): Promise<string | null> {
  if (!env.CLERK_SECRET_KEY) return null;

  try {
    const response = await fetch(`${CLERK_API_BASE_URL}/users/${encodeURIComponent(userId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return null;
    const data = await response.json();
    // Le compte plateforme (SUPER_ADMIN_EMAILS) est super admin même sans métadonnée Clerk.
    if (isSuperAdminEmail(readClerkPrimaryEmail(data))) return 'super_admin';
    return readRoleFromAuthPayload(data);
  } catch {
    return null;
  }
}

async function enrichPayloadWithClerkRole(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const userId = typeof payload.sub === 'string' ? payload.sub.trim() : '';
  if (!userId) return payload;

  const roleFromToken = readRoleFromAuthPayload(payload);
  if (roleFromToken) {
    clerkRoleCache.set(userId, {
      role: roleFromToken,
      expiresAt: Date.now() + CLERK_ROLE_CACHE_TTL_MS,
    });
    return mergeRoleIntoPayload(payload, roleFromToken);
  }

  const cached = clerkRoleCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return mergeRoleIntoPayload(payload, cached.role);
  }

  const fetchedRole = await fetchClerkRole(userId);
  clerkRoleCache.set(userId, {
    role: fetchedRole,
    expiresAt: Date.now() + CLERK_ROLE_CACHE_TTL_MS,
  });

  return mergeRoleIntoPayload(payload, fetchedRole);
}

function buildAuthFromPayload(payload: Record<string, unknown>): RequestAuth | null {
  const userId = typeof payload.sub === 'string' ? payload.sub.trim() : '';
  if (!userId) return null;
  return { userId, payload };
}

async function readDevAuthFallback(token: string): Promise<RequestAuth | null> {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const enriched = await enrichPayloadWithClerkRole(payload);
  return buildAuthFromPayload(enriched);
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

    const enrichedPayload = await enrichPayloadWithClerkRole(payload as Record<string, unknown>);
    const auth = buildAuthFromPayload(enrichedPayload);
    if (!auth) {
      throw new Error('Invalid Clerk JWT: missing subject claim.');
    }

    return auth;
  } catch (error) {
    if (env.NODE_ENV === 'development') {
      const fallbackAuth = await readDevAuthFallback(token);
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
