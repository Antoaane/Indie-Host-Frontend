// File: src/views/Editor/utils/listingApi.ts

import { getListingsController } from '@/domain/listings/controller'
import type {
  DraftPatch,
  RawListingBundle,
  UserListingCard,
  VolatileBundle,
} from '@/domain/listings/types'

const controller = getListingsController()

export type { DraftPatch, VolatileBundle, UserListingCard }

export async function fetchEditableListingBundle(listingId: string): Promise<RawListingBundle> {
  return controller.fetchEditableListingBundle(listingId)
}

export async function fetchVolatileListingBundle(listingId: string): Promise<VolatileBundle> {
  return controller.fetchVolatileListingBundle(listingId)
}

export async function fetchUserListings(userId: string): Promise<UserListingCard[]> {
  return controller.fetchListings({ userId })
}

export async function publishListingDraft(listingId: string, draft: RawListingBundle): Promise<void> {
  return controller.publishListingDraft(listingId, draft)
}

export async function patchListingDraft(listingId: string, patch: DraftPatch): Promise<void> {
  return controller.patchListingDraft(listingId, patch)
}
