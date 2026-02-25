// File: src/views/Editor/utils/editorSourceStatic.ts

import { getListingsController } from '@/domain/listings/controller'
import type { EditorSource } from '@/views/Editor/types/editor'

export function createStaticEditorSource(): EditorSource {
  const controller = getListingsController()

  return {
    fetchListings: async () => {
      console.log('[Editor][source][static] fetchListings')
      return controller.fetchListings()
    },
    fetchEditableListingBundle: async (listingId: string) => {
      console.log('[Editor][source][static] fetchEditableListingBundle', { listingId })
      return controller.fetchEditableListingBundle(listingId)
    },
    fetchVolatileListingBundle: async (listingId: string) => {
      console.log('[Editor][source][static] fetchVolatileListingBundle', { listingId })
      return controller.fetchVolatileListingBundle(listingId)
    },
    patchListingDraft: async (listingId: string, patch) => {
      console.log('[Editor][source][static] patchListingDraft', { listingId, patch })
      return controller.patchListingDraft(listingId, patch)
    },
    publishListingDraft: async (listingId: string, draft) => {
      console.log('[Editor][source][static] publishListingDraft', { listingId })
      return controller.publishListingDraft(listingId, draft)
    },
    createListing: async (payload) => {
      console.log('[Editor][source][static] createListing', { payload })
      return controller.createListing(payload)
    },
  }
}
