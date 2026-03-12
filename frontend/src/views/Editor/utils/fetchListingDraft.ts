// File: src/views/Editor/utils/fetchListingDraft.ts

import type { RawListingBundle } from '@/domain/listings/types'

const DRAFT_STORAGE_PREFIX = 'indiehost:listing-draft:'
const PUBLISHED_SNAPSHOT_STORAGE_PREFIX = 'indiehost:listing-published-snapshot:'
const inMemoryDraftByListingId = new Map<string, RawListingBundle>()
const inMemoryPublishedSnapshotByListingId = new Map<string, RawListingBundle>()

export function getListingDraftStorageKey(listingId: string): string {
  return `${DRAFT_STORAGE_PREFIX}${listingId}`
}

export function isListingDraftStorageKey(key: string): boolean {
  return key.startsWith(DRAFT_STORAGE_PREFIX)
}

export function getListingPublishedSnapshotStorageKey(listingId: string): string {
  return `${PUBLISHED_SNAPSHOT_STORAGE_PREFIX}${listingId}`
}

export function isListingPublishedSnapshotStorageKey(key: string): boolean {
  return key.startsWith(PUBLISHED_SNAPSHOT_STORAGE_PREFIX)
}

function coerceObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function cloneDraft(draft: RawListingBundle): RawListingBundle {
  return JSON.parse(
    JSON.stringify({
      core: draft.core ?? null,
      bookings: draft.bookings ?? null,
      medias: draft.medias ?? null,
      arrival: draft.arrival ?? null,
      notes: draft.notes ?? null,
      comments: draft.comments ?? null,
      host: draft.host ?? null,
    }),
  ) as RawListingBundle
}

function coerceDraftRecord(value: unknown): RawListingBundle | null {
  const parsed = coerceObject(value)
  if (!parsed) return null

  const payload = coerceObject(parsed.draft) ?? parsed

  return {
    core: (payload.core as RawListingBundle['core']) ?? null,
    bookings: (payload.bookings as RawListingBundle['bookings']) ?? null,
    medias: (payload.medias as RawListingBundle['medias']) ?? null,
    arrival: (payload.arrival as RawListingBundle['arrival']) ?? null,
    notes: (payload.notes as RawListingBundle['notes']) ?? null,
    comments: (payload.comments as RawListingBundle['comments']) ?? null,
    host: (payload.host as RawListingBundle['host']) ?? null,
  }
}

export function setInMemoryListingDraft(listingId: string, draft: RawListingBundle) {
  const normalizedListingId = listingId.trim()
  if (!normalizedListingId) return
  inMemoryDraftByListingId.set(normalizedListingId, cloneDraft(draft))
}

export function setInMemoryListingPublishedSnapshot(listingId: string, snapshot: RawListingBundle) {
  const normalizedListingId = listingId.trim()
  if (!normalizedListingId) return
  inMemoryPublishedSnapshotByListingId.set(normalizedListingId, cloneDraft(snapshot))
}

export function getInMemoryListingDraft(listingId: string): RawListingBundle | null {
  const normalizedListingId = listingId.trim()
  if (!normalizedListingId) return null
  const draft = inMemoryDraftByListingId.get(normalizedListingId)
  return draft ? cloneDraft(draft) : null
}

export function getInMemoryListingPublishedSnapshot(listingId: string): RawListingBundle | null {
  const normalizedListingId = listingId.trim()
  if (!normalizedListingId) return null
  const snapshot = inMemoryPublishedSnapshotByListingId.get(normalizedListingId)
  return snapshot ? cloneDraft(snapshot) : null
}

function clearInMemoryListingDraft(listingId: string) {
  const normalizedListingId = listingId.trim()
  if (!normalizedListingId) return
  inMemoryDraftByListingId.delete(normalizedListingId)
}

function clearInMemoryListingPublishedSnapshot(listingId: string) {
  const normalizedListingId = listingId.trim()
  if (!normalizedListingId) return
  inMemoryPublishedSnapshotByListingId.delete(normalizedListingId)
}

export function fetchListingDraft(listingId: string): RawListingBundle | null {
  const memoryDraft = getInMemoryListingDraft(listingId)
  if (memoryDraft) return memoryDraft

  if (typeof window === 'undefined') return null
  if (typeof localStorage === 'undefined') return null

  const key = getListingDraftStorageKey(listingId)
  const stored = localStorage.getItem(key)
  if (!stored) return null

  try {
    const parsed = coerceDraftRecord(JSON.parse(stored))
    if (!parsed) return null
    setInMemoryListingDraft(listingId, parsed)
    return parsed
  } catch {
    localStorage.removeItem(key)
    return null
  }
}

export function fetchListingPublishedSnapshot(listingId: string): RawListingBundle | null {
  const memorySnapshot = getInMemoryListingPublishedSnapshot(listingId)
  if (memorySnapshot) return memorySnapshot

  if (typeof window === 'undefined') return null
  if (typeof localStorage === 'undefined') return null

  const key = getListingPublishedSnapshotStorageKey(listingId)
  const stored = localStorage.getItem(key)
  if (!stored) return null

  try {
    const parsed = coerceDraftRecord(JSON.parse(stored))
    if (!parsed) return null
    setInMemoryListingPublishedSnapshot(listingId, parsed)
    return parsed
  } catch {
    localStorage.removeItem(key)
    return null
  }
}

export function clearListingDraft(listingId: string) {
  clearInMemoryListingDraft(listingId)

  if (typeof window === 'undefined') return
  if (typeof localStorage === 'undefined') return

  localStorage.removeItem(getListingDraftStorageKey(listingId))
}

export function clearListingPublishedSnapshot(listingId: string) {
  clearInMemoryListingPublishedSnapshot(listingId)

  if (typeof window === 'undefined') return
  if (typeof localStorage === 'undefined') return

  localStorage.removeItem(getListingPublishedSnapshotStorageKey(listingId))
}
