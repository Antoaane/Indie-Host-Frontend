// File: src/domain/listings/status.ts

export type ListingStatus =
  | 'published'
  | 'archived'
  | 'blocked'
  | 'paused'
  | 'deleted'
  | string

export function normalizeListingStatus(status?: string | null): string {
  const normalized = (status ?? '').trim().toLowerCase()
  if (normalized === 'draft') return 'published'
  return normalized
}

export function getListingStatusFlags(status?: string | null) {
  const normalized = normalizeListingStatus(status)

  const isDeleted = normalized === 'deleted'
  const isPaused = normalized === 'paused'
  const isBlocked = normalized === 'blocked'

  return {
    normalized,
    isDeleted,
    isPaused,
    isBlocked,
    isPublished: normalized === 'published',
    isArchived: normalized === 'archived',
    isVisiblePublic: !isPaused && !isDeleted,
    isBookable: !isBlocked && !isPaused && !isDeleted,
  }
}

export function filterDeletedListings<T extends { status?: string | null }>(items: T[], includeDeleted?: boolean) {
  if (includeDeleted) return items
  return items.filter((item) => normalizeListingStatus(item.status) !== 'deleted')
}
