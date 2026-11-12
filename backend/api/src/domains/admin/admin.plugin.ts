// Routes de l'administration (`/admin/*`) : chiffres, paiements, droits des comptes, santé des
// services et carte du code. Toutes exigent une session d'administrateur, sauf l'affichage de la
// carte, qui exige un ticket signé délivré à un administrateur (un cadre n'envoie pas de session).

import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';

import { env } from '../../config/env.js';
import { hasAdminAccess } from '../../lib/authRole.js';
import { asObject } from '../../lib/json.js';
import { buildAdminOverview } from './adminOverview.js';
import { buildAdminPayments } from './adminPayments.js';
import { AdminUserActionError, setAdminRole, setUserBlocked } from './adminUsers.js';
import {
  FLOORPLAN_VIEW_HEADERS,
  createFloorplanTicket,
  isFloorplanTicketValid,
  readFloorplanMapHtml,
  readFloorplanMapInfo,
} from './floorplanMap.js';
import { SystemHealthMonitor } from './systemHealth.js';

const clerkUserParamsSchema = z.object({
  clerkUserId: z.string().trim().regex(/^user_[A-Za-z0-9]{6,64}$/),
});
const roleBodySchema = z.object({ role: z.enum(['admin', 'none']) });
const blockedBodySchema = z.object({ blocked: z.boolean() });
const refreshQuerySchema = z.object({ refresh: z.string().optional() });
const floorplanViewQuerySchema = z.object({ token: z.string().optional() });

function wantsRefresh(query: unknown): boolean {
  const { refresh } = refreshQuerySchema.parse(asObject(query));
  return refresh === '1' || refresh === 'true';
}

// Après `fastify.authenticate` : il a déjà répondu 401 sans session valide.
async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (reply.sent) return;
  if (!hasAdminAccess(request.auth)) {
    reply.code(403).send({ message: 'Admin access required.' });
  }
}

export const adminPlugin = fp(async (fastify) => {
  const monitor = new SystemHealthMonitor({ prisma: fastify.prisma }, fastify.log);
  if (env.NODE_ENV !== 'test') {
    fastify.addHook('onReady', async () => {
      monitor.start();
    });
    fastify.addHook('onClose', async () => {
      monitor.stop();
    });
  }

  const adminOnly = { preHandler: [fastify.authenticate, requireAdmin] };

  fastify.get('/admin/overview', adminOnly, async (request, reply) => {
    reply.send(await buildAdminOverview(fastify.prisma, monitor.snapshot(), { refresh: wantsRefresh(request.query) }));
  });

  fastify.get('/admin/payments', adminOnly, async (request, reply) => {
    reply.send(await buildAdminPayments(fastify.prisma, { refresh: wantsRefresh(request.query) }));
  });

  fastify.get('/admin/system/health', adminOnly, async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.send(monitor.snapshot());
  });

  fastify.post('/admin/system/health/refresh', adminOnly, async (_request, reply) => {
    const refreshed = await monitor.refreshNow();
    reply.header('Cache-Control', 'no-store');
    reply.send({ refreshed, snapshot: monitor.snapshot() });
  });

  fastify.put('/admin/users/:clerkUserId/role', adminOnly, async (request, reply) => {
    const { clerkUserId } = clerkUserParamsSchema.parse(request.params);
    const { role } = roleBodySchema.parse(asObject(request.body));
    try {
      const access = await setAdminRole(request.auth!, clerkUserId, role === 'admin');
      request.log.info({ actor: request.auth?.userId, target: clerkUserId, role }, '[admin] role changed');
      reply.send({ clerkUserId, access });
    } catch (error) {
      if (error instanceof AdminUserActionError) {
        reply.code(error.statusCode).send({ message: error.message, code: error.code });
        return;
      }
      throw error;
    }
  });

  fastify.put('/admin/users/:clerkUserId/blocked', adminOnly, async (request, reply) => {
    const { clerkUserId } = clerkUserParamsSchema.parse(request.params);
    const { blocked } = blockedBodySchema.parse(asObject(request.body));
    try {
      const access = await setUserBlocked(request.auth!, clerkUserId, blocked);
      request.log.info({ actor: request.auth?.userId, target: clerkUserId, blocked }, '[admin] account access changed');
      reply.send({ clerkUserId, access });
    } catch (error) {
      if (error instanceof AdminUserActionError) {
        reply.code(error.statusCode).send({ message: error.message, code: error.code });
        return;
      }
      throw error;
    }
  });

  fastify.post('/admin/floorplan/ticket', adminOnly, async (_request, reply) => {
    const info = await readFloorplanMapInfo();
    if (!info.available) {
      reply.send({ ...info, token: null, expiresAtISO: null });
      return;
    }
    reply.send({ ...info, ...createFloorplanTicket() });
  });

  fastify.get('/admin/floorplan/view', async (request, reply) => {
    const { token } = floorplanViewQuerySchema.parse(asObject(request.query));
    if (!isFloorplanTicketValid(token)) {
      reply.code(403).type('text/plain; charset=utf-8').send('Lien expiré : rouvrez la carte depuis l’administration.');
      return;
    }
    const html = await readFloorplanMapHtml();
    if (!html) {
      reply.code(404).type('text/plain; charset=utf-8').send('La carte du code n’a pas encore été générée.');
      return;
    }
    reply.headers(FLOORPLAN_VIEW_HEADERS).send(html);
  });
});
