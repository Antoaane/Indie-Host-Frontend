import fp from 'fastify-plugin';
import type { FastifyRequest } from 'fastify';

import { env } from '../../config/env.js';
import { PrivacyRequestError, PrivacyService } from './privacy.service.js';
import { verifySvixSignature } from './svix.js';

function readHeader(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function buildExportFilename(now = new Date()): string {
  const date = now.toISOString().slice(0, 10);
  return `indiehost-export-${date}.json`;
}

/**
 * Droits RGPD du compte : export (`GET /users/me/export`), suppression (`DELETE /users/me`) et
 * webhook Clerk `user.deleted` (`POST /webhooks/clerk`, signature Svix).
 */
export const privacyPlugin = fp(async (fastify) => {
  const service = new PrivacyService(fastify.prisma);

  fastify.get('/users/me/export', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    if (!request.auth) {
      reply.code(401).send({ message: 'Authentication required.' });
      return;
    }

    const data = await service.exportUserData(request.auth);
    if (!data) {
      reply.code(401).send({ message: 'Authentication required.' });
      return;
    }

    reply
      .header('Content-Disposition', `attachment; filename="${buildExportFilename()}"`)
      .header('Cache-Control', 'no-store')
      .type('application/json; charset=utf-8')
      .send(JSON.stringify(data, null, 2));
  });

  fastify.delete('/users/me', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    if (!request.auth) {
      reply.code(401).send({ message: 'Authentication required.' });
      return;
    }

    try {
      const result = await service.deleteAccount(request.auth);
      if (result.clerk === 'failed') {
        request.log.error({ userId: result.userId }, 'Account anonymized but the Clerk user could not be deleted');
      } else if (result.clerk === 'skipped') {
        request.log.warn({ userId: result.userId }, 'Account anonymized; Clerk deletion skipped (CLERK_SECRET_KEY missing)');
      } else {
        request.log.info({ userId: result.userId, counts: result.counts }, 'Account deleted (anonymized) at the user’s request');
      }

      reply.send({
        deleted: true,
        clerk: result.clerk,
        ...(result.clerk === 'failed'
          ? {
              warning:
                'Vos données ont été supprimées, mais la fermeture de votre identifiant de connexion a échoué. Écrivez à contact@indiehost.fr pour la finaliser.',
            }
          : {}),
      });
    } catch (error) {
      if (error instanceof PrivacyRequestError) {
        reply.code(error.statusCode).send({
          message: error.message,
          code: error.code,
          ...(error.details ? { details: error.details } : {}),
        });
        return;
      }
      throw error;
    }
  });

  if (!env.CLERK_WEBHOOK_SECRET) {
    fastify.log.warn('Clerk webhook disabled (CLERK_WEBHOOK_SECRET is empty): POST /webhooks/clerk answers 503 and user.deleted events are not processed.');
  }

  // Plugin enfant (pas `fp`) : le corps n'est gardé en texte brut, pour la vérification de signature,
  // que pour cette route.
  await fastify.register(async (scope) => {
    scope.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
      done(null, body);
    });

    scope.post('/webhooks/clerk', async (request, reply) => {
      const secret = env.CLERK_WEBHOOK_SECRET;
      if (!secret) {
        reply.code(503).send({ message: 'Clerk webhook is not configured.' });
        return;
      }

      const rawBody = typeof request.body === 'string' ? request.body : '';
      const verification = verifySvixSignature(secret, {
        id: readHeader(request, 'svix-id'),
        timestamp: readHeader(request, 'svix-timestamp'),
        signature: readHeader(request, 'svix-signature'),
      }, rawBody);

      if (!verification.ok) {
        request.log.warn({ reason: verification.reason }, 'Clerk webhook rejected');
        reply.code(401).send({ message: 'Invalid webhook signature.' });
        return;
      }

      let event: Record<string, unknown> | null = null;
      try {
        event = asRecord(JSON.parse(rawBody));
      } catch {
        event = null;
      }
      if (!event) {
        reply.code(400).send({ message: 'Invalid webhook payload.' });
        return;
      }

      const type = typeof event.type === 'string' ? event.type : '';
      if (type === 'user.deleted') {
        const data = asRecord(event.data);
        const clerkUserId = typeof data?.id === 'string' ? data.id.trim() : '';
        if (!clerkUserId) {
          reply.code(400).send({ message: 'Invalid webhook payload.' });
          return;
        }

        const result = await service.handleClerkUserDeleted(clerkUserId);
        if (result.subscriptionWarning) {
          request.log.warn(
            { clerkUserId, userId: result.status === 'not_found' ? null : result.userId },
            'Clerk user deleted while a Stripe subscription is still ongoing: cancel it manually in Stripe',
          );
        }
        request.log.info({ clerkUserId, status: result.status }, 'Clerk user.deleted processed');
      }

      reply.send({ received: true });
    });
  });
});
