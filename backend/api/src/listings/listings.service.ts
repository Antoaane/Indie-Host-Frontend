import { Injectable } from '@nestjs/common'

import type { AuthUser } from '@/auth/interfaces/auth-user.interface'
import type { CreateListingDto } from '@/listings/dto/create-listing.dto'
import { ListingsRepository } from '@/listings/listings.repository'

@Injectable()
export class ListingsService {
  constructor(private readonly listingsRepository: ListingsRepository) {}

  async createListing(payload: CreateListingDto, authUser: AuthUser | null): Promise<{ listingId: string }> {
    const listing = await this.listingsRepository.createListing(payload, authUser?.userId ?? null)
    return { listingId: listing.publicId }
  }

  async getPublicListings() {
    return this.listingsRepository.getPublicListings()
  }

  async getCore(listingId: string) {
    return this.listingsRepository.getCoreResource(listingId)
  }

  async patchCore(listingId: string, patch: Record<string, unknown>) {
    return this.listingsRepository.patchCoreResource(listingId, patch)
  }

  async getHost(listingId: string) {
    return this.listingsRepository.getHostResource(listingId)
  }

  async patchHost(listingId: string, patch: Record<string, unknown>) {
    return this.listingsRepository.patchHostResource(listingId, patch)
  }

  async getUserListings(userId: string) {
    return this.listingsRepository.getUserListings(userId)
  }
}
