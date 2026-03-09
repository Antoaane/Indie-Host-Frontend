import type { RawAmenity, RawArrival, RawCore, RawListingBundle } from '@/domain/listings/types'

export type BookingScrapedData = {
  coordinates?: { latitude?: number; longitude?: number }
  room_type?: string
  person_capacity?: number
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
  images?: Array<{ title?: string; url: string }>
  house_rules?: {
    general?: Array<{
      title: string
      values: Array<{ title: string }>
    }>
  }
  listing_url?: string
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
}

function buildArrivalFromHouseRules(
  rules?: { general?: Array<{ title: string; values: Array<{ title: string }> }> }
): Partial<RawArrival> | null {
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

export function transformBookingToRawListingBundle(
  scraped: BookingScrapedData
): Partial<RawListingBundle> {
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

  const description = scraped.description
    ? scraped.description.includes('<')
      ? scraped.description
      : `<p>${scraped.description}</p>`
    : ''

  return {
    core: {
      title: scraped.title ?? '',
      type: scraped.room_type ?? 'Logement entier',
      latitude: scraped.coordinates?.latitude,
      longitude: scraped.coordinates?.longitude,
      lat: scraped.coordinates?.latitude,
      lng: scraped.coordinates?.longitude,
      zoom: 13,
      guest_capacity: scraped.person_capacity ?? 1,
      city: scraped.city,
      region: scraped.region,
      country: scraped.country ?? 'France',
      description,
      amenities,
      rooms: [] as NonNullable<RawCore['rooms']>,
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
