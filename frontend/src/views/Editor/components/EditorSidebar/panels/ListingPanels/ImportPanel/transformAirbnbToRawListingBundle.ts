import type { RawAmenity, RawArrival, RawCore, RawListingBundle } from '@/domain/listings/types'

export type AirbnbScrapedData = {
  coordinates?: { latitude?: number; longitude?: number }
  room_type?: string
  person_capacity?: number
  sub_description?: { title?: string; items?: string[] }
  description?: string
  title?: string
  amenities?: Array<{
    title: string
    values: Array<{
      title: string
      subtitle?: string
      icon?: string
      available?: boolean
    }>
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

function buildRoomsFromSubDescription(sub?: { items?: string[] }): NonNullable<RawCore['rooms']> {
  const items = sub?.items ?? []
  const rooms: NonNullable<RawCore['rooms']> = []
  for (const item of items) {
    if (/lit|bed/i.test(item)) {
      rooms.push({ 'room-name': item, type: 'bedroom', beds: [] })
    }
    if (/salle de bain|bathroom/i.test(item)) {
      rooms.push({ 'room-name': 'Salle de bain', type: 'bathroom' })
    }
    if (/chambre|bedroom/i.test(item) && !/salle de bain/i.test(item)) {
      rooms.push({ 'room-name': item, type: 'bedroom', beds: [] })
    }
    if (/cuisine|kitchen/i.test(item)) {
      rooms.push({ 'room-name': 'Cuisine', type: 'livingroom' })
    }
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

export function transformAirbnbToRawListingBundle(scraped: AirbnbScrapedData): Partial<RawListingBundle> {
  const amenities: RawAmenity[] = []
  for (const group of scraped.amenities ?? []) {
    for (const item of group.values ?? []) {
      if (item.available !== false && item.title) {
        amenities.push({
          id: slugify(item.title) || `amenity_${amenities.length}`,
          name: item.title,
          description: item.subtitle ?? '',
          category: group.title ?? '',
        })
      }
    }
  }

  const locFromSub = parseLocationFromTitle(scraped.sub_description?.title)
  const locFromDesc = parseLocationFromDescriptions(scraped.location_descriptions)
  const location = locFromSub ?? locFromDesc ?? {}

  const description = scraped.description
    ? scraped.description.includes('<')
      ? scraped.description
      : `<p>${scraped.description}</p>`
    : ''

  return {
    core: {
      title: scraped.title || scraped.sub_description?.title || '',
      type: scraped.room_type || 'Logement entier',
      latitude: scraped.coordinates?.latitude,
      longitude: scraped.coordinates?.longitude,
      lat: scraped.coordinates?.latitude,
      lng: scraped.coordinates?.longitude,
      zoom: 13,
      guest_capacity: scraped.person_capacity ?? 1,
      city: location.city,
      region: location.region,
      country: location.country ?? 'France',
      description,
      amenities,
      rooms: buildRoomsFromSubDescription(scraped.sub_description),
    },
    medias: {
      images: (scraped.images ?? []).map((img, i) => ({
        src: img.url,
        alt: img.title ?? `Photo ${i + 1}`,
        position: i,
      })),
      videos: [],
    },
    arrival: buildArrivalFromHouseRules(scraped.house_rules),
  }
}
