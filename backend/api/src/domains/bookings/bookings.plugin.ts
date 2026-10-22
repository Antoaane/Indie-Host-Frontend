import type { FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { asObject } from '../../lib/json.js';
import {
  bookingAccessQuerySchema,
  cancelBookingSchema,
  bookingGuideMessageSchema,
  bookingGuideParamsSchema,
  bookingConfirmationParamsSchema,
  createBookingSchema,
  listingBookingsParamsSchema,
  updateBookingParamsSchema,
  updateBookingSchema,
} from './bookings.schemas.js';
import { BookingsService } from './bookings.service.js';
import { PaymentsService } from '../payments/payments.service.js';
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
  const paymentsService = new PaymentsService(fastify.prisma);
  const service = new BookingsService(fastify.prisma, paymentsService);

  fastify.get('/bookings/listings/:listingId', {
    preHandler: fastify.authenticateOptional,
  }, async (request, reply) => {
    const { listingId } = listingBookingsParamsSchema.parse(request.params);
    const bookings = await service.getListingBookings(listingId);

    if (!bookings) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    const access = await resolveListingAccess(fastify.prisma, listingId, request.auth);
    reply.send(access?.canReadPrivate ? bookings : redactBookingsForPublic(bookings));
  });

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
    preHandler: fastify.authenticateOptional,
  }, async (request, reply) => {
    const payload = createBookingSchema.parse(asObject(request.body));
    const created = await service.createBooking(payload);

    if (!created) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    // Le voyageur ne reçoit que sa propre réservation, jamais celles des autres.
    reply.code(201).send({ ...created, bookings: redactBookingsForPublic(created.bookings) });
  });

  fastify.patch('/bookings/:reservationId', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const { reservationId } = updateBookingParamsSchema.parse(request.params);
    const payload = updateBookingSchema.parse(asObject(request.body));

    const access = await resolveListingAccess(fastify.prisma, payload.listingId, request.auth);
    if (!access) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    if (!access.canReadPrivate) {
      reply.code(403).send({ message: 'You cannot edit this reservation.' });
      return;
    }

    const updated = await service.updateBooking(reservationId, payload.listingId, payload.patch);

    if (!updated || updated === 'not_found') {
      reply.code(404).send({ message: 'Reservation not found.' });
      return;
    }

    reply.send(updated);
  });
});
