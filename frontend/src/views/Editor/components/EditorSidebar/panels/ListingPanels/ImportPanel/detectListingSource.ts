// File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/ImportPanel/detectListingSource.ts

export type ListingSource = 'airbnb' | 'booking' | null

const AIRBNB_PATTERNS = [
  /^https?:\/\/(www\.)?airbnb\.(fr|com|co\.uk|es|de|it)\/rooms\//i,
  /^https?:\/\/airbnb\.com\/rooms\/\d+/i,
]

const BOOKING_PATTERNS = [/^https?:\/\/(www\.)?booking\.com\/hotel\//i]

/** Regex pour liens mobiles Airbnb sans protocole (ex. airbnb.fr/rooms/123?unique_share_id=…) */
const AIRBNB_MOBILE_REGEX =
  /^(?:https?:\/\/)?(?:www\.)?(airbnb\.(?:fr|com|co\.uk|es|de|it))\/rooms\/(\d+)/i

/** Regex pour liens Booking sans protocole ou avec query params mobiles */
const BOOKING_MOBILE_REGEX = /^(?:https?:\/\/)?(?:www\.)?(booking\.com\/hotel\/[^?#]+)/i

/**
 * Normalise une URL de partage (ex. lien iPhone sans https) en URL canonique
 * reconnue par la détection et le scraper.
 */
export function normalizeListingUrl(url: string): string {
  const trimmed = (url ?? '').trim()
  if (!trimmed) return trimmed

  const airbnbMatch = trimmed.match(AIRBNB_MOBILE_REGEX)
  if (airbnbMatch) {
    const [, host, roomId] = airbnbMatch
    return `https://www.${host}/rooms/${roomId}`
  }

  const bookingMatch = trimmed.match(BOOKING_MOBILE_REGEX)
  if (bookingMatch) {
    const [, path] = bookingMatch
    return `https://www.${path}`
  }

  return trimmed
}

export function detectListingSource(url: string): ListingSource {
  const trimmed = (url ?? '').trim()
  if (!trimmed) return null
  const normalized = normalizeListingUrl(trimmed)
  if (AIRBNB_PATTERNS.some((p) => p.test(normalized))) return 'airbnb'
  if (BOOKING_PATTERNS.some((p) => p.test(normalized))) return 'booking'
  return null
}
