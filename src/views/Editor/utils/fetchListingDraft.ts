// File: src/views/Editor/utils/fetchListingDraft.ts

import type { RawListingBundle } from '@/domain/listings/types'

const DRAFT_STORAGE_PREFIX = 'indiehost:listing-draft:'

export function getListingDraftStorageKey(listingId: string): string {
  return `${DRAFT_STORAGE_PREFIX}${listingId}`
}

function coerceObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

export function fetchListingDraft(listingId: string): RawListingBundle | null {
  if (typeof window === 'undefined') return null
  if (typeof localStorage === 'undefined') return null

  const key = getListingDraftStorageKey(listingId)
  const stored = localStorage.getItem(key)
  if (!stored) return null

  try {
    const parsed = coerceObject(JSON.parse(stored))
    if (!parsed) return null

    return {
      core: (parsed.core as RawListingBundle['core']) ?? null,
      bookings: (parsed.bookings as RawListingBundle['bookings']) ?? null,
      medias: (parsed.medias as RawListingBundle['medias']) ?? null,
    }
  } catch {
    return null
  }
}

export function clearListingDraft(listingId: string) {
  if (typeof window === 'undefined') return
  if (typeof localStorage === 'undefined') return

  localStorage.removeItem(getListingDraftStorageKey(listingId))
}
