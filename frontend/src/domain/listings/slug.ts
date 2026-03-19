// File: src/domain/listings/slug.ts

const LISTING_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const TRANSIENT_LISTING_ID_PATTERN = /^(?:landing|listing)-preview(?:-[a-z0-9]+)?$/i
const LISTING_ID_PATTERN = /^listing-[a-z0-9]+(?:-[a-z0-9]+)*$/i
const LEGACY_NUMERIC_LISTING_ID_PATTERN = /^\d+$/

function toTrimmedString(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function stripAccents(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function normalizeListingSlug(value: unknown): string {
  const input = toTrimmedString(value)
  if (!input) return ''

  const normalized = stripAccents(input)
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/['’`´]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized
}

export function isValidListingSlug(value: unknown): boolean {
  const slug = toTrimmedString(value).toLowerCase()
  if (!slug) return false
  return LISTING_SLUG_PATTERN.test(slug)
}

export function isTransientListingId(value: unknown): boolean {
  const id = toTrimmedString(value)
  if (!id) return false
  return TRANSIENT_LISTING_ID_PATTERN.test(id)
}

export function isListingIdLike(value: unknown): boolean {
  const id = toTrimmedString(value)
  if (!id) return false
  return LISTING_ID_PATTERN.test(id) || LEGACY_NUMERIC_LISTING_ID_PATTERN.test(id)
}

export function buildListingSlug({
  existingSlug,
  title,
  listingId,
  fallback = 'annonce',
}: {
  existingSlug?: unknown
  title?: unknown
  listingId?: unknown
  fallback?: string
}): string {
  const fromExisting = normalizeListingSlug(existingSlug)
  if (fromExisting) return fromExisting

  const fromTitle = normalizeListingSlug(title)
  if (fromTitle) return fromTitle

  if (!isTransientListingId(listingId)) {
    const fromListingId = normalizeListingSlug(listingId)
    if (fromListingId) return fromListingId
  }

  const fallbackSlug = normalizeListingSlug(fallback)
  return fallbackSlug || 'annonce'
}

export function buildUniqueListingSlug(baseSlug: string, isTaken: (slug: string) => boolean): string {
  const normalizedBase = normalizeListingSlug(baseSlug) || 'annonce'
  if (!isTaken(normalizedBase)) return normalizedBase

  let index = 2
  while (isTaken(`${normalizedBase}-${index}`)) {
    index += 1
  }

  return `${normalizedBase}-${index}`
}
