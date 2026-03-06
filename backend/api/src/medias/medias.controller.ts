import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common'

import { ClerkAuthGuard } from '@/auth/guards/clerk-auth.guard'
import { MediasService } from '@/medias/medias.service'

@Controller('listings/medias')
export class MediasController {
  constructor(private readonly mediasService: MediasService) {}

  @Get(':listingId')
  async getMedias(@Param('listingId') listingId: string) {
    return this.mediasService.getMedias(listingId)
  }

  @Patch(':listingId')
  @UseGuards(ClerkAuthGuard)
  async patchMedias(
    @Param('listingId') listingId: string,
    @Body() patch: Record<string, unknown>,
  ) {
    return this.mediasService.patchMedias(listingId, patch)
  }
}
