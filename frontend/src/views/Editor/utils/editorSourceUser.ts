// File: src/views/Editor/utils/editorSourceUser.ts

import { getListingsController } from '@/domain/listings/controller'
import type { EditorSource } from '@/views/Editor/types/editor'

type UserEditorSourceOptions = {
  adminViewAllListings?: boolean
}

export function createUserEditorSource(userId: string, options?: UserEditorSourceOptions): EditorSource {
  const controller = getListingsController()
  const adminViewAllListings = Boolean(options?.adminViewAllListings)

  return {
    fetchListings: async () => {
      console.log('[Editor][source][user] fetchListings', { userId, adminViewAllListings })
      return controller.fetchListings({ userId, adminViewAll: adminViewAllListings })
    },
    fetchEditableListingBundle: async (listingId: string) => {
      console.log('[Editor][source][user] fetchEditableListingBundle', { listingId })
      return controller.fetchEditableListingBundle(listingId)
    },
    fetchVolatileListingBundle: async (listingId: string) => {
      console.log('[Editor][source][user] fetchVolatileListingBundle', { listingId })
      return controller.fetchVolatileListingBundle(listingId)
    },
    patchListingDraft: async (listingId: string, patch) => {
      console.log('[Editor][source][user] patchListingDraft', { listingId, patch })
      return controller.patchListingDraft(listingId, patch)
    },
    publishListingDraft: async (listingId: string, draft) => {
      console.log('[Editor][source][user] publishListingDraft', { listingId })
      return controller.publishListingDraft(listingId, draft)
    },
    createListing: async (payload) => {
      console.log('[Editor][source][user] createListing', { userId, payload })
      // Depuis /dashboard/editor/:userId, un admin crée l'annonce directement pour ce client.
      return controller.createListing(payload, { ownerId: userId })
    },
  }
}
