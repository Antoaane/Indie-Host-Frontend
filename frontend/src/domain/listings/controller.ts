// File: src/domain/listings/controller.ts

import type {
  DraftPatch,
  ListingAvailabilitySyncResult,
  RawListingBundle,
  UserListingCard,
  VolatileBundle,
} from '@/domain/listings/types'
import { createLocalJsonListingsController } from '@/domain/local-json/listingsController'
import { createApiListingsController } from '@/domain/api/listingsController'

export type ListingsDataMode = 'local-json' | 'api'

export type FetchListingsOptions = {
  userId?: string | null
  includeDeleted?: boolean
}

export type ListingsController = {
  mode: ListingsDataMode
  fetchListings: (options?: FetchListingsOptions) => Promise<UserListingCard[]>
  resolveListingIdByHostname: (hostname: string) => Promise<string | null>
  fetchListingBundle: (listingId: string) => Promise<RawListingBundle>
  fetchEditableListingBundle: (listingId: string) => Promise<RawListingBundle>
  fetchVolatileListingBundle: (listingId: string) => Promise<VolatileBundle>
  syncListingAvailability: (listingId: string) => Promise<ListingAvailabilitySyncResult>
  patchListingDraft: (listingId: string, patch: DraftPatch) => Promise<void>
  publishListingDraft: (listingId: string, draft: RawListingBundle) => Promise<void>
  createListing: (payload?: Partial<RawListingBundle>) => Promise<{ listingId: string }>
}

let cachedController: ListingsController | null = null

function resolveListingsDataMode(): ListingsDataMode {
  const raw = (import.meta.env.VITE_LISTINGS_DATA_MODE ?? 'local-json').toString().trim().toLowerCase()
  if (raw === 'api') return 'api'
  return 'local-json'
}

export function getListingsController(): ListingsController {
  if (cachedController) return cachedController

  const mode = resolveListingsDataMode()
  console.log('[Domain][listings] resolve controller mode =', mode)

  cachedController = mode === 'api'
    ? createApiListingsController()
    : createLocalJsonListingsController()

  return cachedController
}
