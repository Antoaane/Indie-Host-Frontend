// File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/ImportPanel/transformBookingToRawListingBundle.ts

import type { RawAmenity, RawArrival, RawCore, RawListingBundle, RawNotes } from '@/domain/listings/types'
import { getKnownAmenityCatalogItem, isKnownAmenityId, sanitizeKnownAmenities } from '@/utils/amenitiesCatalog'

export type BookingScrapedData = {
  coordinates?: { latitude?: number; longitude?: number }
  room_type?: string
  person_capacity?: number
  price?: number
  average_rating?: number
  review_count?: number
  overview_items?: string[]
  room_counts?: {
    guest_capacity?: number
    bedrooms?: number
    beds?: number
    bathrooms?: number
    kitchens?: number
  }
  precise_address?: string
  location_descriptions?: Array<{ title?: string; content?: string }>
  description?: string
  title?: string
  city?: string
  region?: string
  country?: string
  amenities?: Array<{
    title: string
    values: Array<{
      title: string
      subtitle?: string
      available?: boolean
    }>
  }>
  /** Amenities deja mappees IndieHost par le backend (prioritaires sur amenities + buildAmenities). */
  amenities_indiehost?: Array<{
    id: string
    name: string
    description?: string
    category?: string
    relevance?: number
    pinned?: boolean
    perkEligible?: boolean
    perkScore?: number
    perkPriority?: number
  }>
  images?: Array<{ title?: string; url: string }>
  house_rules?: {
    general?: Array<{
      title: string
      values: Array<{ title: string }>
    }>
  }
  listing_url?: string
}

function normalizeText(value?: string): string {
  return value
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim() ?? ''
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function parseLocationFromDescriptions(
  descriptions?: Array<{ title?: string; content?: string }>,
): { city?: string; region?: string; country?: string } | null {
  const source = descriptions?.find((entry) => entry.title?.trim())?.title
  if (!source) return null
  const parts = source.split(',').map((s) => s.trim()).filter(Boolean)
  if (!parts.length) return null

  if (parts.length >= 4) {
    return {
      city: parts[parts.length - 3] ?? undefined,
      region: parts[parts.length - 2] ?? undefined,
      country: parts[parts.length - 1] ?? undefined,
    }
  }

  return {
    city: parts[0] ?? undefined,
    region: parts[1] ?? undefined,
    country: parts[2] ?? undefined,
  }
}

type BookingRoomCounts = NonNullable<BookingScrapedData['room_counts']>

type RoomCountMatcher = {
  key: keyof BookingRoomCounts
  pattern: RegExp
}

const ROOM_COUNT_MATCHERS: RoomCountMatcher[] = [
  { key: 'guest_capacity', pattern: /(\d+|one|a|an)\s+(guest|guests|adult|adults|person|persons|people|voyageur|voyageurs)/i },
  { key: 'bedrooms', pattern: /(\d+|one|a|an)\s+(bedroom|bedrooms|chambre|chambres)/i },
  { key: 'beds', pattern: /(\d+|one|a|an)\s+(bed|beds|lit|lits)/i },
  { key: 'bathrooms', pattern: /(\d+|one|a|an)\s+(bathroom|bathrooms|bath|baths|salle(?:s)? de bain(?:s)?)/i },
  { key: 'kitchens', pattern: /(\d+|one|a|an)\s+(kitchen|kitchens|cuisine|cuisines)/i },
]

function parseCountToken(value?: string): number | null {
  const normalized = normalizeText(value)
  if (!normalized) return null
  if (/^\d+$/.test(normalized)) return Number(normalized)
  if (['one', 'a', 'an'].includes(normalized)) return 1
  return null
}

function parseRoomCountsFromItems(items?: string[]): BookingRoomCounts {
  const counts: BookingRoomCounts = {}
  for (const item of items ?? []) {
    for (const matcher of ROOM_COUNT_MATCHERS) {
      const match = item.match(matcher.pattern)
      if (!match) continue
      const parsed = parseCountToken(match[1])
      if (!parsed) continue
      const current = counts[matcher.key] ?? 0
      counts[matcher.key] = Math.max(current, parsed)
    }
  }
  return counts
}

function mergeRoomCounts(...roomCounts: Array<BookingRoomCounts | undefined>): BookingRoomCounts {
  const merged: BookingRoomCounts = {}
  for (const counts of roomCounts) {
    if (!counts) continue
    for (const [key, value] of Object.entries(counts)) {
      if (typeof value !== 'number' || value <= 0) continue
      const typedKey = key as keyof BookingRoomCounts
      merged[typedKey] = Math.max(merged[typedKey] ?? 0, value)
    }
  }
  return merged
}

function inferAmenityId(title?: string, subtitle?: string, category?: string): string | null {
  const haystack = [title, subtitle, category].map(normalizeText).join(' ')

  if (!haystack) return null
  if (/\bwifi\b/.test(haystack)) return 'WIFI'
  if (/dedicated workspace|workspace|bureau|espace de travail/.test(haystack)) return 'DEDICATED_WORKSPACE'
  if (/self check in|auto check in|arrivee autonome|entree autonome/.test(haystack)) return 'SELF_CHECK_IN'
  if (/smart lock|serrure connectee/.test(haystack)) return 'SMART_LOCK'
  if (/parking for two cars|parking 2 voitures/.test(haystack)) return 'PARKING_FOR_TWO_CARS'
  if (/private parking|parking prive/.test(haystack)) return 'PRIVATE_PARKING'
  if (/free parking|parking gratuit/.test(haystack)) return 'FREE_PARKING_ON_PREMISES'
  if (/heated pool|piscine chauffee/.test(haystack)) return 'HEATED_POOL'
  if (/pool|piscine/.test(haystack)) return 'HEATED_POOL'
  if (/portable air conditioning|climatisation mobile/.test(haystack)) return 'PORTABLE_AIR_CONDITIONING'
  if (/air conditioning|air conditionne|climatisation/.test(haystack)) return 'REVERSIBLE_AIR_CONDITIONING'
  if (/equipped kitchen|full kitchen|cuisine equipee|kitchen/.test(haystack)) return 'EQUIPPED_KITCHEN'
  if (/walk to beach|beach access|plage a pied/.test(haystack)) return 'WALK_TO_BEACH'
  if (/panoramic lake view|vue panoramique/.test(haystack)) return 'PANORAMIC_LAKE_VIEW'
  if (/mont blanc view|vue mont blanc/.test(haystack)) return 'MONT_BLANC_VIEW'
  if (/canal view|vue sur le canal/.test(haystack)) return 'CANAL_VIEW'
  if (/terrace|terrasse/.test(haystack)) return 'WOOD_TERRACE'
  if (/elevator|lift|ascenseur/.test(haystack)) return 'ELEVATOR'
  return null
}

function buildAmenities(scraped: BookingScrapedData): RawAmenity[] {
  const amenities: RawAmenity[] = []
  const seen = new Set<string>()

  for (const group of scraped.amenities ?? []) {
    for (const item of group.values ?? []) {
      if (item.available === false || !item.title) continue

      const inferredId = inferAmenityId(item.title, item.subtitle, group.title)
      if (!inferredId || !isKnownAmenityId(inferredId)) continue

      const catalogItem = getKnownAmenityCatalogItem(inferredId)
      const key = `${normalizeText(group.title)}::${normalizeText(item.title)}::${inferredId}`
      if (seen.has(key)) continue
      seen.add(key)

      amenities.push({
        id: inferredId,
        name: catalogItem?.name ?? item.title,
        description: item.subtitle ?? catalogItem?.description ?? '',
        category: group.title ?? catalogItem?.category,
      })
    }
  }

  return sanitizeKnownAmenities(amenities)
}

function buildDescriptionHtml(scraped: BookingScrapedData): string {
  if (!scraped.description) return ''
  if (scraped.description.includes('<')) return scraped.description

  return scraped.description
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block)}</p>`)
    .join('')
}

function buildRoomsFromScrapedData(scraped: BookingScrapedData, amenities: RawAmenity[]): NonNullable<RawCore['rooms']> {
  const roomCounts = mergeRoomCounts(parseRoomCountsFromItems(scraped.overview_items), scraped.room_counts)
  const hasKitchenAmenity = amenities.some((amenity) =>
    amenity.id === 'EQUIPPED_KITCHEN'
    || /cuisine|kitchen/i.test(amenity.name)
    || /cuisine|kitchen/i.test(amenity.category ?? ''),
  )

  const bedrooms = roomCounts.bedrooms ?? 0
  const beds = roomCounts.beds ?? 0
  const bathrooms = roomCounts.bathrooms ?? 0
  const kitchens = roomCounts.kitchens ?? (hasKitchenAmenity ? 1 : 0)
  const effectiveBedrooms = bedrooms > 0 ? bedrooms : beds > 0 ? 1 : 0
  const rooms: NonNullable<RawCore['rooms']> = []

  for (let index = 0; index < effectiveBedrooms; index += 1) {
    rooms.push({
      'room-name': effectiveBedrooms === 1 ? 'Chambre' : `Chambre ${index + 1}`,
      type: 'bedroom',
      beds: index === 0 && beds > 0
        ? [{ type: 'simple', quantity: beds, capacity: 1 }]
        : [],
    })
  }

  for (let index = 0; index < bathrooms; index += 1) {
    rooms.push({
      'room-name': bathrooms === 1 ? 'Salle de bain' : `Salle de bain ${index + 1}`,
      type: 'bathroom',
    })
  }

  for (let index = 0; index < kitchens; index += 1) {
    rooms.push({
      'room-name': kitchens === 1 ? 'Cuisine' : `Cuisine ${index + 1}`,
      type: 'kitchen',
      beds: [],
    })
  }

  return rooms
}

function buildArrivalFromHouseRules(
  rules?: { general?: Array<{ title: string; values: Array<{ title: string }> }> },
): Partial<RawArrival> | null {
  if (!rules?.general?.length) return null
  const accessLines: string[] = []
  for (const group of rules.general) {
    for (const value of group.values ?? []) {
      if (value.title) accessLines.push(value.title)
    }
  }

  const checkIn = accessLines.find((value) => /arrivée|check.?in|à partir de/i.test(value))
  const checkOut = accessLines.find((value) => /départ|check.?out|avant \d|avant$/i.test(value))

  return {
    intro: {
      title: 'Bienvenue',
      subtitle: "Pour profiter des lieux au maximum, voici votre guide d'arrivée.",
      tagline: 'Propulsé par IndieHost',
    },
    practical: {
      savings: { message: 'Réservez en direct pour éviter les commissions.' },
      access: {
        address: '',
        checkIn: checkIn ?? 'À préciser.',
        checkOut: checkOut ?? 'À préciser.',
        parking: '',
      },
      services: {
        wifi: '',
        contacts: 'Urgences 112 · Médecin 15 · Police 17.',
        assistance: '',
      },
      rules: '',
      shops: '',
    },
    guide: { title: '', content: '' },
  }
}

function buildImageDedupKey(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''

  try {
    const parsed = new URL(trimmed)
    return `${parsed.origin}${parsed.pathname}`.toLowerCase()
  } catch {
    return trimmed.split('?')[0]?.split('#')[0]?.toLowerCase() ?? trimmed.toLowerCase()
  }
}

function dedupeImportedImages(images?: Array<{ title?: string; url: string }>) {
  const seen = new Set<string>()

  return (images ?? []).filter((img) => {
    const key = buildImageDedupKey(img.url)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function buildEmptyRatingDistribution() {
  return {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  }
}

function amenitiesFromScraped(scraped: BookingScrapedData): RawAmenity[] {
  if (scraped.amenities_indiehost?.length) {
    return sanitizeKnownAmenities(scraped.amenities_indiehost.flatMap((amenity) => {
      if (!isKnownAmenityId(amenity.id)) return []

      const catalogItem = getKnownAmenityCatalogItem(amenity.id)
      return [{
        id: amenity.id,
        name: catalogItem?.name ?? amenity.name,
        description: amenity.description ?? catalogItem?.description ?? '',
        category: amenity.category ?? catalogItem?.category,
        relevance: amenity.relevance,
        pinned: amenity.pinned,
        perkEligible: amenity.perkEligible,
        perkScore: amenity.perkScore,
        perkPriority: amenity.perkPriority,
      }]
    }))
  }

  return buildAmenities(scraped)
}

export function transformBookingToRawListingBundle(
  scraped: BookingScrapedData,
): Partial<RawListingBundle> {
  const amenities = amenitiesFromScraped(scraped)
  const rawAverageRating =
    typeof scraped.average_rating === 'number' && Number.isFinite(scraped.average_rating)
      ? scraped.average_rating
      : null
  const averageRating = rawAverageRating !== null
    ? Number((rawAverageRating > 5 ? rawAverageRating / 2 : rawAverageRating).toFixed(2))
    : null
  const reviewCount =
    typeof scraped.review_count === 'number' && Number.isFinite(scraped.review_count) && scraped.review_count >= 0
      ? Math.round(scraped.review_count)
      : null
  const notes: Partial<RawNotes> | null = averageRating !== null
    ? {
        note: {
          note: averageRating,
          distribution: buildEmptyRatingDistribution(),
          source: 'booking',
          reviewCount: reviewCount ?? undefined,
        },
        'otas-note': [
          {
            ota: 'booking',
            note: averageRating,
            distribution: buildEmptyRatingDistribution(),
            reviewCount: reviewCount ?? undefined,
            sourceLabel: 'Booking.com',
          },
        ],
      }
    : null

  const locFromDesc = parseLocationFromDescriptions(scraped.location_descriptions)
  const roomCounts = mergeRoomCounts(parseRoomCountsFromItems(scraped.overview_items), scraped.room_counts)
  const location = {
    city: scraped.city ?? locFromDesc?.city,
    region: scraped.region ?? locFromDesc?.region,
    country: scraped.country ?? locFromDesc?.country ?? 'France',
  }

  const arrival = buildArrivalFromHouseRules(scraped.house_rules)
  if (arrival?.practical?.access) {
    arrival.practical.access.address = scraped.precise_address ?? [
      location.city,
      location.region,
      location.country,
    ].filter(Boolean).join(', ')
  }

  return {
    core: {
      title: scraped.title ?? '',
      type: scraped.room_type ?? 'Logement entier',
      latitude: scraped.coordinates?.latitude,
      longitude: scraped.coordinates?.longitude,
      lat: scraped.coordinates?.latitude,
      lng: scraped.coordinates?.longitude,
      zoom: 13,
      guest_capacity: scraped.person_capacity ?? roomCounts.guest_capacity ?? 1,
      precise_address: scraped.precise_address ?? '',
      city: location.city,
      region: location.region,
      country: location.country,
      description: buildDescriptionHtml(scraped),
      amenities,
      rooms: buildRoomsFromScrapedData(scraped, amenities),
    },
    bookings: {
      price: typeof scraped.price === 'number' && Number.isFinite(scraped.price) ? Math.max(0, Math.round(scraped.price)) : 0,
    },
    medias: {
      images: dedupeImportedImages(scraped.images).map((img, i) => ({
        src: img.url,
        alt: img.title ?? `Photo ${i + 1}`,
        position: i,
      })),
      videos: [],
    },
    arrival,
    notes,
  }
}
