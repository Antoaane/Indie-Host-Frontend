import { Injectable } from '@nestjs/common'

import { BookingsRepository } from '@/bookings/bookings.repository'

@Injectable()
export class BookingsService {
  constructor(private readonly bookingsRepository: BookingsRepository) {}

  async getBookings(listingId: string) {
    return this.bookingsRepository.getBookingsResource(listingId)
  }

  async patchBookings(listingId: string, patch: Record<string, unknown>) {
    return this.bookingsRepository.patchBookingsResource(listingId, patch)
  }
}
