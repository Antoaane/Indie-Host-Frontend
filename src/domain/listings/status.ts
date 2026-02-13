// File: src/domain/listings/status.ts

export type ListingStatus =
  | 'published'
  | 'draft'
  | 'archived'
  | 'blocked'
  | 'paused'
  | 'deleted'
  | string

export function normalizeListingStatus(status?: string | null): string {
  return (status ?? '').trim().toLowerCase()
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
    isDraft: normalized === 'draft',
    isArchived: normalized === 'archived',
    isVisiblePublic: !isPaused && !isDeleted,
    isBookable: !isBlocked && !isPaused && !isDeleted,
  }
}

export function filterDeletedListings<T extends { status?: string | null }>(items: T[], includeDeleted?: boolean) {
  if (includeDeleted) return items
  return items.filter((item) => normalizeListingStatus(item.status) !== 'deleted')
}
