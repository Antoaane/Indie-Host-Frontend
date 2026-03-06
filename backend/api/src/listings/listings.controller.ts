import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'

import { CurrentAuth } from '@/auth/decorators/current-auth.decorator'
import { ClerkAuthGuard } from '@/auth/guards/clerk-auth.guard'
import { OptionalClerkAuthGuard } from '@/auth/guards/optional-clerk-auth.guard'
import type { AuthUser } from '@/auth/interfaces/auth-user.interface'
import { CreateListingDto } from '@/listings/dto/create-listing.dto'
import { ListingsService } from '@/listings/listings.service'

@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  async listPublicListings() {
    return this.listingsService.getPublicListings()
  }

  @Post()
  @UseGuards(OptionalClerkAuthGuard)
  async createListing(
    @Body() payload: CreateListingDto,
    @CurrentAuth() authUser: AuthUser | null,
  ) {
    return this.listingsService.createListing(payload, authUser)
  }

  @Get('core/:listingId')
  async getCore(@Param('listingId') listingId: string) {
    return this.listingsService.getCore(listingId)
  }

  @Patch('core/:listingId')
  @UseGuards(ClerkAuthGuard)
  async patchCore(
    @Param('listingId') listingId: string,
    @Body() patch: Record<string, unknown>,
  ) {
    return this.listingsService.patchCore(listingId, patch)
  }

  @Get('host/:listingId')
  async getHost(@Param('listingId') listingId: string) {
    return this.listingsService.getHost(listingId)
  }

  @Patch('host/:listingId')
  @UseGuards(ClerkAuthGuard)
  async patchHost(
    @Param('listingId') listingId: string,
    @Body() patch: Record<string, unknown>,
  ) {
    return this.listingsService.patchHost(listingId, patch)
  }
}
