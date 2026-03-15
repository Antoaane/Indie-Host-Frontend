// File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/ImportPanel/transformAirbnbToRawListingBundle.ts

import { getAmenityPerkDefaults } from '@/domain/listings/perks'
import type { RawAmenity, RawArrival, RawCore, RawListingBundle } from '@/domain/listings/types'
import { getKnownAmenityCatalogItem, isKnownAmenityId } from '@/utils/amenitiesCatalog'

export type AirbnbScrapedData = {
  coordinates?: { latitude?: number; longitude?: number }
  room_type?: string
  person_capacity?: number
  price?: number
  sub_description?: { title?: string; items?: string[] }
  overview_items?: string[]
  room_counts?: {
    guest_capacity?: number
    bedrooms?: number
    beds?: number
    bathrooms?: number
    kitchens?: number
  }
  highlight_titles?: string[]
  description?: string
  title?: string
  precise_address?: string
  city?: string
  region?: string
  country?: string
  amenities?: Array<{
    title: string
    values: Array<{
      title: string
      subtitle?: string
      icon?: string
      available?: boolean
    }>
  }>
  /** Amenities déjà mappées IndieHost par le backend (prioritaires sur amenities + buildAmenities). */
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
  location_descriptions?: Array<{ title?: string; content?: string }>
  listing_url?: string
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
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

function textsLooselyMatch(a?: string, b?: string): boolean {
  const left = normalizeText(a)
  const right = normalizeText(b)
  if (!left || !right) return false
  return left === right || left.includes(right) || right.includes(left)
}

function parseLocationFromTitle(title?: string): { city?: string; region?: string; country?: string } | null {
  if (!title) return null
  const parts = title.split(' - ')
  const last = parts[parts.length - 1] ?? ''
  const locParts = last.split(',').map((s) => s.trim())
  const city = locParts[0] ?? ''
  const region = locParts[1] ?? ''
  const country = locParts[2] ?? 'France'
  return { city: city || undefined, region: region || undefined, country }
}

function parseLocationFromDescriptions(descriptions?: Array<{ title?: string }>): { city?: string; region?: string; country?: string } | null {
  const first = descriptions?.[0]?.title
  if (!first) return null
  const parts = first.split(',').map((s) => s.trim())
  return {
    city: parts[0] ?? undefined,
    region: parts[1] ?? undefined,
    country: parts[2] ?? 'France',
  }
}

type AirbnbRoomCounts = NonNullable<AirbnbScrapedData['room_counts']>

type RoomCountMatcher = {
  key: keyof AirbnbRoomCounts
  pattern: RegExp
}

const ROOM_COUNT_MATCHERS: RoomCountMatcher[] = [
  { key: 'guest_capacity', pattern: /(\d+|un|une|one|a|an)\s+(guest|guests|voyageur|voyageurs|person|persons|people)/i },
  { key: 'bedrooms', pattern: /(\d+|un|une|one|a|an)\s+(bedroom|bedrooms|chambre|chambres)/i },
  { key: 'beds', pattern: /(\d+|un|une|one|a|an)\s+(bed|beds|lit|lits)/i },
  { key: 'bathrooms', pattern: /(\d+|un|une|one|a|an)\s+(bathroom|bathrooms|bath|baths|salle(?:s)? de bain(?:s)?)/i },
  { key: 'kitchens', pattern: /(\d+|un|une|one|a|an)\s+(kitchen|kitchens|cuisine|cuisines)/i },
]

function parseCountToken(value?: string): number | null {
  const normalized = normalizeText(value)
  if (!normalized) return null
  if (/^\d+$/.test(normalized)) return Number(normalized)
  if (['un', 'une', 'one', 'a', 'an'].includes(normalized)) return 1
  return null
}

function parseRoomCountsFromItems(items?: string[]): AirbnbRoomCounts {
  const counts: AirbnbRoomCounts = {}
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

function mergeRoomCounts(...roomCounts: Array<AirbnbRoomCounts | undefined>): AirbnbRoomCounts {
  const merged: AirbnbRoomCounts = {}
  for (const counts of roomCounts) {
    if (!counts) continue
    for (const [key, value] of Object.entries(counts)) {
      if (typeof value !== 'number' || value <= 0) continue
      const typedKey = key as keyof AirbnbRoomCounts
      merged[typedKey] = Math.max(merged[typedKey] ?? 0, value)
    }
  }
  return merged
}

function inferAmenityId(title?: string, subtitle?: string, category?: string): string | null {
  const haystack = [title, subtitle, category].map(normalizeText).join(' ')

  if (!haystack) return null
  if (/\bwifi\b/.test(haystack)) return 'WIFI'
  if (/dedicated workspace|espace de travail dedie|bureau/.test(haystack)) return 'DEDICATED_WORKSPACE'
  if (/self check in|arrivee autonome|entree autonome/.test(haystack)) return 'SELF_CHECK_IN'
  if (/smart lock|serrure connectee/.test(haystack)) return 'SMART_LOCK'
  if (/parking 2 voitures|parking for two cars/.test(haystack)) return 'PARKING_FOR_TWO_CARS'
  if (/parking prive|private parking/.test(haystack)) return 'PRIVATE_PARKING'
  if (/parking gratuit sur place|free parking on premises|free parking/.test(haystack)) return 'FREE_PARKING_ON_PREMISES'
  if (/piscine chauffee|heated pool/.test(haystack)) return 'HEATED_POOL'
  if (/climatisation mobile|portable air conditioning/.test(haystack)) return 'PORTABLE_AIR_CONDITIONING'
  if (/climatisation|air conditioning|air conditionne/.test(haystack)) return 'REVERSIBLE_AIR_CONDITIONING'
  if (/cuisine equipee|equipped kitchen/.test(haystack)) return 'EQUIPPED_KITCHEN'
  if (/cuisine|kitchen/.test(haystack)) return 'EQUIPPED_KITCHEN'
  if (/plage a pied|walk to beach/.test(haystack)) return 'WALK_TO_BEACH'
  if (/vue panoramique|panoramic lake view/.test(haystack)) return 'PANORAMIC_LAKE_VIEW'
  if (/vue mont blanc|mont blanc view/.test(haystack)) return 'MONT_BLANC_VIEW'
  if (/vue sur le canal|canal view/.test(haystack)) return 'CANAL_VIEW'
  if (/terrasse/.test(haystack)) return 'WOOD_TERRACE'
  if (/ascenseur|elevator/.test(haystack)) return 'ELEVATOR'
  return null
}

function buildAmenities(scraped: AirbnbScrapedData): RawAmenity[] {
  const highlightTitles = scraped.highlight_titles ?? []
  const matchedHighlights = new Set<number>()
  const amenities: RawAmenity[] = []
  const seenAmenityKeys = new Set<string>()

  for (const group of scraped.amenities ?? []) {
    for (const item of group.values ?? []) {
      if (item.available === false || !item.title) continue

      const inferredId = inferAmenityId(item.title, item.subtitle, group.title)
      const slugifiedId = slugify(item.title)
      const id = inferredId ?? (slugifiedId || `amenity_${amenities.length}`)
      const matchedHighlightIndex = highlightTitles.findIndex((highlight) =>
        textsLooselyMatch(item.title, highlight)
        || textsLooselyMatch(item.subtitle, highlight)
        || textsLooselyMatch(id, highlight)
      )
      const isHighlighted = matchedHighlightIndex >= 0
      if (isHighlighted) matchedHighlights.add(matchedHighlightIndex)

      const perkDefaults = getAmenityPerkDefaults(id)
      const amenityKey = `${normalizeText(group.title)}::${normalizeText(item.title)}`
      if (seenAmenityKeys.has(amenityKey)) continue
      seenAmenityKeys.add(amenityKey)

      amenities.push({
        id,
        name: item.title,
        description: item.subtitle ?? '',
        category: group.title ?? '',
        relevance: isHighlighted ? 95 : undefined,
        pinned: isHighlighted || undefined,
        perkEligible: isHighlighted || perkDefaults?.perkEligible || undefined,
        perkScore: isHighlighted ? perkDefaults?.perkScore ?? 80 : perkDefaults?.perkScore,
        perkPriority: isHighlighted ? perkDefaults?.perkPriority ?? 1 : perkDefaults?.perkPriority,
      })
    }
  }

  return amenities
}

function buildDescriptionHtml(scraped: AirbnbScrapedData): string {
  if (!scraped.description) return ''
  if (scraped.description.includes('<')) return scraped.description

  return scraped.description
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block)}</p>`)
    .join('')
}

function buildRoomsFromScrapedData(scraped: AirbnbScrapedData, amenities: RawAmenity[]): NonNullable<RawCore['rooms']> {
  const parsedCounts = parseRoomCountsFromItems(scraped.overview_items ?? scraped.sub_description?.items)
  const roomCounts = mergeRoomCounts(parsedCounts, scraped.room_counts)
  const hasKitchenAmenity = amenities.some((amenity) =>
    amenity.id === 'EQUIPPED_KITCHEN'
    || /cuisine|kitchen/i.test(amenity.name)
    || /cuisine|kitchen/i.test(amenity.category ?? '')
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

function buildArrivalFromHouseRules(rules?: { general?: Array<{ title: string; values: Array<{ title: string }> }> }): Partial<RawArrival> | null {
  if (!rules?.general?.length) return null
  const accessLines: string[] = []
  for (const g of rules.general) {
    for (const v of g.values ?? []) {
      if (v.title) accessLines.push(v.title)
    }
  }
  const checkIn = accessLines.find((s) => /arrivée|check.?in|à partir de/i.test(s))
  const checkOut = accessLines.find((s) => /départ|check.?out|avant \d|avant$/i.test(s))
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
    // Airbnb renvoie souvent la même photo avec des query params différents.
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

function amenitiesFromScraped(scraped: AirbnbScrapedData): RawAmenity[] {
  if (scraped.amenities_indiehost?.length) {
    return scraped.amenities_indiehost.flatMap((a) => {
      if (!isKnownAmenityId(a.id)) return []

      const catalogItem = getKnownAmenityCatalogItem(a.id)
      return [{
        id: a.id,
        name: catalogItem?.name ?? a.name,
        description: a.description ?? catalogItem?.description ?? '',
        category: a.category ?? catalogItem?.category,
        relevance: a.relevance,
        pinned: a.pinned,
        perkEligible: a.perkEligible,
        perkScore: a.perkScore,
        perkPriority: a.perkPriority,
      }]
    })
  }
  return buildAmenities(scraped).filter((amenity) => isKnownAmenityId(amenity.id))
}

export function transformAirbnbToRawListingBundle(scraped: AirbnbScrapedData): Partial<RawListingBundle> {
  const amenities = amenitiesFromScraped(scraped)

  const locFromSub = parseLocationFromTitle(scraped.sub_description?.title)
  const locFromDesc = parseLocationFromDescriptions(scraped.location_descriptions)
  const location = {
    city: scraped.city ?? locFromSub?.city ?? locFromDesc?.city,
    region: scraped.region ?? locFromSub?.region ?? locFromDesc?.region,
    country: scraped.country ?? locFromSub?.country ?? locFromDesc?.country ?? 'France',
  }

  const description = buildDescriptionHtml(scraped)
  const roomCounts = mergeRoomCounts(parseRoomCountsFromItems(scraped.overview_items ?? scraped.sub_description?.items), scraped.room_counts)

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
      title: scraped.title || scraped.sub_description?.title || '',
      type: scraped.room_type || 'Logement entier',
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
      description,
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
  }
}
