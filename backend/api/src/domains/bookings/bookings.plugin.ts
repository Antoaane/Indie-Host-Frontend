import fp from 'fastify-plugin';

import { asObject } from '../../lib/json.js';
import {
  createBookingSchema,
  listingBookingsParamsSchema,
  updateBookingParamsSchema,
  updateBookingSchema,
} from './bookings.schemas.js';
import { BookingsService } from './bookings.service.js';

export const bookingsPlugin = fp(async (fastify) => {
  const service = new BookingsService(fastify.prisma);

  fastify.get('/bookings/listings/:listingId', async (request, reply) => {
    const { listingId } = listingBookingsParamsSchema.parse(request.params);
    const bookings = await service.getListingBookings(listingId);

    if (!bookings) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    reply.send(bookings);
  });

  fastify.post('/bookings', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const payload = createBookingSchema.parse(asObject(request.body));
    const created = await service.createBooking(payload);

    if (!created) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    reply.code(201).send(created);
  });

  fastify.patch('/bookings/:reservationId', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const { reservationId } = updateBookingParamsSchema.parse(request.params);
    const payload = updateBookingSchema.parse(asObject(request.body));

    const updated = await service.updateBooking(reservationId, payload.listingId, payload.patch);

    if (!updated || updated === 'not_found') {
      reply.code(404).send({ message: 'Reservation not found.' });
      return;
    }

    reply.send(updated);
  });
});
