import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { asObject } from '../../lib/json.js';
import { resolveListingAccess } from '../listings/listings.access.js';
import { calendarListingParamsSchema, importCalendarSchema, syncParamsSchema } from './calendar.schemas.js';
import { CalendarService } from './calendar.service.js';

export const calendarPlugin = fp(async (fastify) => {
  const service = new CalendarService(fastify.prisma);

  // Les sources contiennent les URL iCal secrètes des OTA : propriétaire ou admin uniquement.
  async function ensureListingOwner(request: FastifyRequest, reply: FastifyReply, listingId: string): Promise<boolean> {
    const access = await resolveListingAccess(fastify.prisma, listingId, request.auth);
    if (!access) {
      reply.code(404).send({ message: 'Listing not found.' });
      return false;
    }

    if (!access.canReadPrivate) {
      reply.code(403).send({ message: 'You cannot manage this listing calendar.' });
      return false;
    }

    return true;
  }

  fastify.get('/calendar/listings/:listingId.ics', async (request, reply) => {
    const { listingId } = calendarListingParamsSchema.parse(request.params);
    const ics = await service.exportListingCalendar(listingId);

    if (!ics) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    reply
      .header('Content-Type', 'text/calendar; charset=utf-8')
      .header('Content-Disposition', `inline; filename="${listingId}.ics"`)
      .send(ics);
  });

  fastify.get('/calendar/listings/:listingId/sources', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const { listingId } = calendarListingParamsSchema.parse(request.params);
    if (!await ensureListingOwner(request, reply, listingId)) return;

    const sources = await service.listCalendarSyncSources(listingId);
    reply.send(sources);
  });

  fastify.post('/calendar/listings/:listingId/import', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const { listingId } = calendarListingParamsSchema.parse(request.params);
    if (!await ensureListingOwner(request, reply, listingId)) return;

    const payload = importCalendarSchema.parse(asObject(request.body));

    const result = await service.importCalendar(listingId, payload);
    if (!result) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    reply.code(201).send(result);
  });

  fastify.post('/calendar/listings/:listingId/refresh', async (request, reply) => {
    const { listingId } = calendarListingParamsSchema.parse(request.params);
    const result = await service.syncListingSourcesForPublicView(listingId);

    if (!result) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    reply.send({
      ...result,
      sources: result.sources.map((source) => ({ ...source, sourceUrl: null, lastError: null })),
    });
  });

  fastify.post('/calendar/listings/:listingId/sources/:syncId/sync', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const { listingId, syncId } = syncParamsSchema.parse(request.params);
    if (!await ensureListingOwner(request, reply, listingId)) return;

    const result = await service.syncCalendarSource(listingId, syncId, { force: true });

    if (!result) {
      reply.code(404).send({ message: 'Sync source not found.' });
      return;
    }

    reply.send(result);
  });
});
