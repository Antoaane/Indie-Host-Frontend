// File: src/views/Editor/utils/persistListingDraft.ts

import type { RawListingBundle } from '@/domain/listings/types'

import {
  getListingDraftStorageKey,
  isListingDraftStorageKey,
  getListingPublishedSnapshotStorageKey,
  isListingPublishedSnapshotStorageKey,
  setInMemoryListingDraft,
  setInMemoryListingPublishedSnapshot,
} from '@/views/Editor/utils/fetchListingDraft'

type PersistStrategy = 'full' | 'strip-inline-images' | 'drop-medias'

const MAX_STORED_IMAGE_SRC_LENGTH = 12_000

function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = (error as { name?: unknown }).name
  const code = (error as { code?: unknown }).code
  const message = typeof (error as { message?: unknown }).message === 'string'
    ? String((error as { message?: unknown }).message).toLowerCase()
    : ''

  return (
    name === 'QuotaExceededError'
    || code === 22
    || message.includes('quota')
    || message.includes('storage')
  )
}

function sanitizeImagesForStorage(images: unknown[]): unknown[] {
  return images
    .map((image) => {
      if (!image || typeof image !== 'object' || Array.isArray(image)) return null
      const imageRecord = { ...(image as Record<string, unknown>) }
      const rawSrc = typeof imageRecord.src === 'string' ? imageRecord.src.trim() : ''
      if (!rawSrc) return null
      if (rawSrc.startsWith('data:')) return null
      if (rawSrc.length > MAX_STORED_IMAGE_SRC_LENGTH) return null
      imageRecord.src = rawSrc
      return imageRecord
    })
    .filter((image): image is Record<string, unknown> => Boolean(image))
}

function buildStoragePayload(draft: RawListingBundle, strategy: PersistStrategy): RawListingBundle {
  const basePayload: RawListingBundle = {
    core: draft.core ?? null,
    bookings: draft.bookings ?? null,
    medias: draft.medias ?? null,
    arrival: draft.arrival ?? null,
  }

  if (strategy === 'full') return basePayload

  if (strategy === 'drop-medias') {
    return {
      ...basePayload,
      medias: { images: [], videos: [] },
    }
  }

  const medias = basePayload.medias
  const mediaRecord = medias && typeof medias === 'object' && !Array.isArray(medias)
    ? (medias as Record<string, unknown>)
    : null

  if (!mediaRecord || !Array.isArray(mediaRecord.images)) {
    return {
      ...basePayload,
      medias: {
        ...(mediaRecord ?? {}),
        images: [],
      },
    }
  }

  return {
    ...basePayload,
    medias: {
      ...mediaRecord,
      images: sanitizeImagesForStorage(mediaRecord.images),
    },
  }
}

function shouldPreferCompactStorage(draft: RawListingBundle): boolean {
  const medias = draft.medias
  if (!medias || typeof medias !== 'object' || Array.isArray(medias)) return false

  const mediaRecord = medias as Record<string, unknown>
  const images = Array.isArray(mediaRecord.images) ? mediaRecord.images : []

  return images.some((image) => {
    if (!image || typeof image !== 'object' || Array.isArray(image)) return false
    const src = typeof (image as Record<string, unknown>).src === 'string'
      ? String((image as Record<string, unknown>).src).trim()
      : ''

    return src.startsWith('data:') || src.length > MAX_STORED_IMAGE_SRC_LENGTH
  })
}

function listStoredKeys(matchesKey: (key: string) => boolean): string[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return []

  const keys: string[] = []
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (!key || !matchesKey(key)) continue
    keys.push(key)
  }

  return keys
}

function clearOtherStoredKeys(currentKey: string, matchesKey: (key: string) => boolean): number {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return 0

  const removableKeys = listStoredKeys(matchesKey).filter((key) => key !== currentKey)
  removableKeys.forEach((key) => {
    localStorage.removeItem(key)
  })

  return removableKeys.length
}

function tryPersistToLocalStorage(
  storageKey: string,
  draft: RawListingBundle,
  strategies: readonly PersistStrategy[],
): { ok: true } | { ok: false; error: unknown } {
  let lastError: unknown = null

  for (const strategy of strategies) {
    try {
      const payload = buildStoragePayload(draft, strategy)
      localStorage.setItem(storageKey, JSON.stringify(payload))
      return { ok: true }
    } catch (error) {
      lastError = error
      if (!isQuotaExceededError(error)) {
        return { ok: false, error: lastError }
      }
    }
  }

  return { ok: false, error: lastError }
}

function toEditableSnapshot(draft: RawListingBundle): RawListingBundle {
  return {
    core: draft.core ?? null,
    bookings: draft.bookings ?? null,
    medias: draft.medias ?? null,
    arrival: draft.arrival ?? null,
  }
}

function persistSnapshot({
  listingId,
  draft,
  storageKey,
  storageKeyMatcher,
  logLabel,
}: {
  listingId: string
  draft: RawListingBundle
  storageKey: string
  storageKeyMatcher: (key: string) => boolean
  logLabel: 'draft' | 'published'
}): void {
  if (typeof window === 'undefined') return
  if (typeof localStorage === 'undefined') return

  const strategies: PersistStrategy[] = shouldPreferCompactStorage(draft)
    ? ['strip-inline-images', 'drop-medias']
    : ['full', 'strip-inline-images', 'drop-medias']

  console.log(`[Editor][${logLabel}] persist`, { listingId })

  const firstAttempt = tryPersistToLocalStorage(storageKey, draft, strategies)
  if (firstAttempt.ok) return

  if (!isQuotaExceededError(firstAttempt.error)) {
    console.warn(`[Editor][${logLabel}] persist failed`, firstAttempt.error)
    return
  }

  const clearedCount = clearOtherStoredKeys(storageKey, storageKeyMatcher)
  if (clearedCount > 0) {
    const secondAttempt = tryPersistToLocalStorage(storageKey, draft, strategies)
    if (secondAttempt.ok) {
      console.warn(`[Editor][${logLabel}] storage quota reached, cleared stale snapshots`, {
        listingId,
        clearedCount,
      })
      return
    }

    if (!isQuotaExceededError(secondAttempt.error)) {
      console.warn(`[Editor][${logLabel}] persist failed after cleanup`, secondAttempt.error)
      return
    }
  }

  console.warn(`[Editor][${logLabel}] storage quota reached, using in-memory fallback`, {
    listingId,
  })
}

export function persistListingDraft(listingId: string, draft: RawListingBundle) {
  const normalizedListingId = listingId.trim()
  if (!normalizedListingId) return

  const memorySnapshot = toEditableSnapshot(draft)
  setInMemoryListingDraft(normalizedListingId, memorySnapshot)
  persistSnapshot({
    listingId: normalizedListingId,
    draft: memorySnapshot,
    storageKey: getListingDraftStorageKey(normalizedListingId),
    storageKeyMatcher: isListingDraftStorageKey,
    logLabel: 'draft',
  })
}

export function persistListingPublishedSnapshot(listingId: string, publishedSnapshot: RawListingBundle) {
  const normalizedListingId = listingId.trim()
  if (!normalizedListingId) return

  const memorySnapshot = toEditableSnapshot(publishedSnapshot)
  setInMemoryListingPublishedSnapshot(normalizedListingId, memorySnapshot)
  persistSnapshot({
    listingId: normalizedListingId,
    draft: memorySnapshot,
    storageKey: getListingPublishedSnapshotStorageKey(normalizedListingId),
    storageKeyMatcher: isListingPublishedSnapshotStorageKey,
    logLabel: 'published',
  })
}
