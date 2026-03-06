import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common'

import { ClerkAuthGuard } from '@/auth/guards/clerk-auth.guard'
import { ArrivalService } from '@/arrival/arrival.service'

@Controller('listings/arrival')
export class ArrivalController {
  constructor(private readonly arrivalService: ArrivalService) {}

  @Get(':listingId')
  async getArrival(@Param('listingId') listingId: string) {
    return this.arrivalService.getArrival(listingId)
  }

  @Patch(':listingId')
  @UseGuards(ClerkAuthGuard)
  async patchArrival(
    @Param('listingId') listingId: string,
    @Body() patch: Record<string, unknown>,
  ) {
    return this.arrivalService.patchArrival(listingId, patch)
  }
}
