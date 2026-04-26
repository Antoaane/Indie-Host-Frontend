// File: src/domain/listings/controller.ts

import type {
  DraftPatch,
  ListingAvailabilitySyncResult,
  RawListingBundle,
  UserListingCard,
  VolatileBundle,
} from '@/domain/listings/types'
import { createApiListingsController } from '@/domain/api/listingsController'

export type ListingsDataMode = 'api'

export type FetchListingsOptions = {
  userId?: string | null
  includeDeleted?: boolean
  adminViewAll?: boolean
}

export type ListingsController = {
  mode: ListingsDataMode
  fetchListings: (options?: FetchListingsOptions) => Promise<UserListingCard[]>
  resolveListingIdByHostname: (hostname: string, listingSlug?: string | null) => Promise<string | null>
  resolveListingIdBySlug: (slug: string) => Promise<string | null>
  fetchListingBundle: (listingId: string) => Promise<RawListingBundle>
  fetchEditableListingBundle: (listingId: string) => Promise<RawListingBundle>
  fetchVolatileListingBundle: (listingId: string) => Promise<VolatileBundle>
  syncListingAvailability: (listingId: string) => Promise<ListingAvailabilitySyncResult>
  patchListingDraft: (listingId: string, patch: DraftPatch) => Promise<void>
  publishListingDraft: (listingId: string, draft: RawListingBundle) => Promise<void>
  createListing: (payload?: Partial<RawListingBundle>) => Promise<{ listingId: string }>
}

let cachedController: ListingsController | null = null

export function getListingsController(): ListingsController {
  if (cachedController) return cachedController

  cachedController = createApiListingsController()
  return cachedController
}
