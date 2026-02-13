// File: src/views/Editor/utils/persistListingDraft.ts

import type { RawListingBundle } from '@/domain/listings/types'

import { getListingDraftStorageKey } from '@/views/Editor/utils/fetchListingDraft'

export function persistListingDraft(listingId: string, draft: RawListingBundle) {
  if (typeof window === 'undefined') return
  if (typeof localStorage === 'undefined') return

  const payload: RawListingBundle = {
    core: draft.core ?? null,
    bookings: draft.bookings ?? null,
    medias: draft.medias ?? null,
    arrival: draft.arrival ?? null,
  }

  console.log('[Editor][draft] persistListingDraft', { listingId })
  localStorage.setItem(getListingDraftStorageKey(listingId), JSON.stringify(payload))
}
