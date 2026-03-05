// File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/ImportPanel/detectListingSource.ts

export type ListingSource = 'airbnb' | 'booking' | null

const AIRBNB_PATTERNS = [
  /^https?:\/\/(www\.)?airbnb\.(fr|com|co\.uk|es|de|it)\/rooms\//i,
  /^https?:\/\/airbnb\.com\/rooms\/\d+/i,
]

const BOOKING_PATTERNS = [/^https?:\/\/(www\.)?booking\.com\/hotel\//i]

export function detectListingSource(url: string): ListingSource {
  const trimmed = (url ?? '').trim()
  if (!trimmed) return null
  if (AIRBNB_PATTERNS.some((p) => p.test(trimmed))) return 'airbnb'
  if (BOOKING_PATTERNS.some((p) => p.test(trimmed))) return 'booking'
  return null
}
