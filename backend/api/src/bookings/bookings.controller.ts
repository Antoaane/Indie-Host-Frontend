import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common'

import { ClerkAuthGuard } from '@/auth/guards/clerk-auth.guard'
import { BookingsService } from '@/bookings/bookings.service'

@Controller('listings/bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get(':listingId')
  async getBookings(@Param('listingId') listingId: string) {
    return this.bookingsService.getBookings(listingId)
  }

  @Patch(':listingId')
  @UseGuards(ClerkAuthGuard)
  async patchBookings(
    @Param('listingId') listingId: string,
    @Body() patch: Record<string, unknown>,
  ) {
    return this.bookingsService.patchBookings(listingId, patch)
  }
}
