// File: src/views/Editor/types/editor.ts

import type { RawListingBundle } from '@/domain/listings/types'
import type { DraftPatch, UserListingCard, VolatileBundle } from '@/views/Editor/utils/listingApi'

export type EditorMode = 'static' | 'user'

export type EditorSource = {
  fetchListings: () => Promise<UserListingCard[]>
  fetchEditableListingBundle: (listingId: string) => Promise<RawListingBundle>
  fetchVolatileListingBundle: (listingId: string) => Promise<VolatileBundle>
  patchListingDraft: (listingId: string, patch: DraftPatch) => Promise<void>
  publishListingDraft: (listingId: string, draft: RawListingBundle) => Promise<void>
}
