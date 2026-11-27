import type { PrismaClient } from '@prisma/client';

import { PaymentsService } from '../payments/payments.service.js';
import { BookingsService } from './bookings.service.js';
import { GroupBookingsService } from './groupBookings.service.js';
import { GroupPaymentLedger } from './groupPaymentLedger.js';

/** Services des réservations, câblés ensemble : les routes et la tâche planifiée partagent ce montage. */
export function createBookingServices(prisma: PrismaClient) {
  const ledger = new GroupPaymentLedger(prisma);
  const payments = new PaymentsService(prisma);
  const bookings = new BookingsService(prisma, payments, ledger);
  const groupBookings = new GroupBookingsService(prisma, bookings, ledger);
  return { payments, bookings, groupBookings, ledger };
}
