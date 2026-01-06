// File: src/views/Editor/utils/persistListingDraft.ts

import type { RawListingBundle } from '@/views/ListingView/utils/useParseContent'

import { getListingDraftStorageKey } from '@/views/Editor/utils/fetchListingDraft'

export function persistListingDraft(listingId: string, draft: RawListingBundle) {
  if (typeof window === 'undefined') return
  if (typeof localStorage === 'undefined') return

  const payload: RawListingBundle = {
    core: draft.core ?? null,
    bookings: draft.bookings ?? null,
    medias: draft.medias ?? null,
  }

  localStorage.setItem(getListingDraftStorageKey(listingId), JSON.stringify(payload))
}
