// File: src/views/Editor/types/editor.ts

import type { RawListingBundle } from '@/views/ListingView/utils/useParseContent'
import type { UserListingCard, VolatileBundle } from '@/views/Editor/utils/listingApi'

export type EditorMode = 'static' | 'user'

export type EditorSource = {
  fetchListings: () => Promise<UserListingCard[]>
  fetchEditableListingBundle: (listingId: string) => Promise<RawListingBundle>
  fetchVolatileListingBundle: (listingId: string) => Promise<VolatileBundle>
  publishListingDraft: (listingId: string, draft: RawListingBundle) => Promise<void>
}

