import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { asObject } from '../../lib/json.js';
import { rateLimitByIp } from '../../lib/rateLimit.js';
import {
  bookingAccessQuerySchema,
  cancelBookingSchema,
  bookingGuideMessageSchema,
  bookingGuideParamsSchema,
  bookingConfirmationParamsSchema,
  createBookingSchema,
  groupInvitationsSchema,
  groupShareIntentSchema,
  groupShareParamsSchema,
  hostCancelBookingSchema,
} from './bookings.schemas.js';
import { createBookingServices } from './groupBookings.factory.js';
import { redactBookingsForPublic, resolveListingAccess } from '../listings/listings.access.js';

function firstHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    const first = value[0]?.trim();
    return first ?? '';
  }

  if (typeof value !== 'string') return '';
  return value.split(',')[0]?.trim() ?? '';
}

function resolvePublicBaseUrl(request: FastifyRequest): string | null {
  const forwardedHost = firstHeaderValue(request.headers['x-forwarded-host']);
  const host = forwardedHost || firstHeaderValue(request.headers.host);
  if (!host) return null;

  const forwardedProto = firstHeaderValue(request.headers['x-forwarded-proto']);
  const protocol = forwardedProto || request.protocol || 'http';
  return `${protocol}://${host}`;
}

export const bookingsPlugin = fp(async (fastify) => {
  const { bookings: service, groupBookings } = createBookingServices(fastify.prisma);

  // --- Paiement à plusieurs --------------------------------------------------------------------
  // Routes sans compte : chaque appel porte la clé signée d'une part (`gp_<part>_<signature>`), reçue
  // par e-mail. La clé de l'organisateur ouvre en plus les invitations et l'annulation.
  const groupRateLimit = (max: number) => rateLimitByIp({
    max,
    windowMs: 10 * 60 * 1000,
    message: 'Trop de demandes à la suite. Réessayez dans quelques minutes.',
  });

  const sendGroupResult = (reply: FastifyReply, result: unknown, code = 200) => {
    if (!result) {
      reply.code(404).send({ message: 'Paiement à plusieurs introuvable.' });
      return;
    }
    if (result === 'forbidden') {
      reply.code(403).send({ message: 'Ce lien n’est pas valide.' });
      return;
    }
    reply.code(code).send(result);
  };

  fastify.get('/bookings/group-payments/:shareKey', {
    preHandler: groupRateLimit(120),
  }, async (request, reply) => {
    const { shareKey } = groupShareParamsSchema.parse(request.params);
    sendGroupResult(reply, await groupBookings.getPage(shareKey));
  });

  fastify.post('/bookings/group-payments/:shareKey/payment-intent', {
    preHandler: groupRateLimit(20),
  }, async (request, reply) => {
    const { shareKey } = groupShareParamsSchema.parse(request.params);
    const payload = groupShareIntentSchema.parse(asObject(request.body));
    sendGroupResult(reply, await groupBookings.createShareIntent(shareKey, payload), 201);
  });

  fastify.post('/bookings/group-payments/:shareKey/confirm', {
    preHandler: groupRateLimit(40),
  }, async (request, reply) => {
    const { shareKey } = groupShareParamsSchema.parse(request.params);
    sendGroupResult(reply, await groupBookings.confirmShare(shareKey));
  });

  fastify.post('/bookings/group-payments/:shareKey/invitations', {
    // Chaque appel peut envoyer des e-mails : limite serrée, en plus du plafond par part.
    preHandler: groupRateLimit(20),
  }, async (request, reply) => {
    const { shareKey } = groupShareParamsSchema.parse(request.params);
    const payload = groupInvitationsSchema.parse(asObject(request.body));
    sendGroupResult(reply, await groupBookings.invite(shareKey, payload.invitations));
  });

  fastify.post('/bookings/group-payments/:shareKey/cancel', {
    preHandler: groupRateLimit(10),
  }, async (request, reply) => {
    const { shareKey } = groupShareParamsSchema.parse(request.params);
    sendGroupResult(reply, await groupBookings.cancel(shareKey));
  });

  // Voyageur sans compte : chaque route ci-dessous exige la clé signée de sa réservation
  // (`rg.<id>.<signature>`, voir `lib/guideKey.ts`), envoyée dans l'adresse ou le corps.
  fastify.get('/bookings/guides/:guideKey', async (request, reply) => {
    const { guideKey } = bookingGuideParamsSchema.parse(request.params);
    const result = await service.getReservationGuideAccess(guideKey, {
      publicBaseUrl: resolvePublicBaseUrl(request),
    });

    if (!result) {
      reply.code(404).send({ message: 'Reservation guide not found.' });
      return;
    }

    if (result === 'forbidden') {
      reply.code(403).send({ message: 'Invalid reservation guide key.' });
      return;
    }

    reply.send(result);
  });

  fastify.get('/bookings/guides/:guideKey/conversation', async (request, reply) => {
    const { guideKey } = bookingGuideParamsSchema.parse(request.params);
    const result = await service.getGuideConversation(guideKey);

    if (!result) {
      reply.code(404).send({ message: 'Reservation guide not found.' });
      return;
    }

    if (result === 'forbidden') {
      reply.code(403).send({ message: 'Invalid reservation guide key.' });
      return;
    }

    if (result === 'locked') {
      reply.code(423).send({ message: 'Guide access is locked until 48h before arrival.' });
      return;
    }

    reply.send(result);
  });

  fastify.post('/bookings/guides/:guideKey/conversation/messages', async (request, reply) => {
    const { guideKey } = bookingGuideParamsSchema.parse(request.params);
    const payload = bookingGuideMessageSchema.parse(asObject(request.body));
    const result = await service.sendGuideConversationMessage(guideKey, payload.body);

    if (!result) {
      reply.code(404).send({ message: 'Reservation guide not found.' });
      return;
    }

    if (result === 'forbidden') {
      reply.code(403).send({ message: 'Invalid reservation guide key.' });
      return;
    }

    if (result === 'locked') {
      reply.code(423).send({ message: 'Guide access is locked until 48h before arrival.' });
      return;
    }

    reply.code(201).send(result);
  });

  fastify.get('/bookings/:reservationId/confirmation', async (request, reply) => {
    const { reservationId } = bookingConfirmationParamsSchema.parse(request.params);
    const { token } = bookingAccessQuerySchema.parse(asObject(request.query));
    const confirmation = await service.getBookingConfirmation(reservationId, token, {
      publicBaseUrl: resolvePublicBaseUrl(request),
    });

    if (!confirmation) {
      reply.code(404).send({ message: 'Reservation not found.' });
      return;
    }

    if (confirmation === 'forbidden') {
      reply.code(403).send({ message: 'Invalid reservation access token.' });
      return;
    }

    reply.send(confirmation);
  });

  fastify.post('/bookings/:reservationId/cancel', async (request, reply) => {
    const { reservationId } = bookingConfirmationParamsSchema.parse(request.params);
    const payload = cancelBookingSchema.parse(asObject(request.body));
    const canceled = await service.cancelBooking(reservationId, payload.token, {
      reason: payload.reason,
      publicBaseUrl: resolvePublicBaseUrl(request),
    });

    if (!canceled) {
      reply.code(404).send({ message: 'Reservation not found.' });
      return;
    }

    if (canceled === 'forbidden') {
      reply.code(403).send({ message: 'Invalid reservation access token.' });
      return;
    }

    reply.send(canceled);
  });

  // Annulation par l'hôte depuis la gestion : remboursement intégral du voyageur, dates libérées.
  fastify.post('/bookings/:reservationId/host-cancel', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const { reservationId } = bookingConfirmationParamsSchema.parse(request.params);
    const payload = hostCancelBookingSchema.parse(asObject(request.body));

    const reservation = await fastify.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { listingId: true },
    });
    const access = reservation
      ? await resolveListingAccess(fastify.prisma, reservation.listingId, request.auth)
      : null;

    if (!reservation || !access) {
      reply.code(404).send({ message: 'Reservation not found.' });
      return;
    }

    if (!access.canReadPrivate) {
      reply.code(403).send({ message: 'You cannot cancel this reservation.' });
      return;
    }

    const canceled = await service.cancelBookingAsHost(reservationId, {
      reason: payload.reason,
      publicBaseUrl: resolvePublicBaseUrl(request),
    });

    if (!canceled || canceled === 'forbidden') {
      reply.code(404).send({ message: 'Reservation not found.' });
      return;
    }

    reply.send(canceled);
  });

  fastify.get('/bookings/:reservationId/stay.ics', async (request, reply) => {
    const { reservationId } = bookingConfirmationParamsSchema.parse(request.params);
    const { token } = bookingAccessQuerySchema.parse(asObject(request.query));
    const ics = await service.exportReservationStayCalendar(reservationId, token, {
      publicBaseUrl: resolvePublicBaseUrl(request),
    });

    if (!ics) {
      reply.code(404).send({ message: 'Reservation not found.' });
      return;
    }

    if (ics === 'forbidden') {
      reply.code(403).send({ message: 'Invalid reservation access token.' });
      return;
    }

    reply
      .header('Content-Type', 'text/calendar; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${reservationId}.ics"`)
      .send(ics);
  });

  fastify.post('/bookings', {
    // Création ouverte aux visiteurs : limitée par IP pour éviter les rafales de réservations.
    preHandler: [
      rateLimitByIp({
        max: 10,
        windowMs: 10 * 60 * 1000,
        message: 'Trop de réservations à la suite. Réessayez dans quelques minutes.',
      }),
      fastify.authenticateOptional,
    ],
  }, async (request, reply) => {
    const payload = createBookingSchema.parse(asObject(request.body));
    const created = await service.createBooking(payload, request.auth, {
      // Paiement à plusieurs : les liens envoyés aux amis ramènent sur le site où la réservation est faite.
      publicBaseUrl: resolvePublicBaseUrl(request),
    });

    if (!created) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    // Le voyageur ne reçoit que sa propre réservation, jamais celles des autres.
    reply.code(201).send({ ...created, bookings: redactBookingsForPublic(created.bookings) });
  });
});
