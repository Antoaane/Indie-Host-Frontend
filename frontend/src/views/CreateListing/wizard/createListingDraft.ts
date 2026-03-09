// File: src/views/CreateListing/wizard/createListingDraft.ts

import type { RawBookings, RawCore, RawListingBundle, RawMedias } from '@/domain/listings/types'
import { normalizeListingStatus } from '@/domain/listings/status'

export const CREATE_LISTING_STORAGE_PREFIX = 'indiehost:create-listing:draft:v1'

/** Clé sessionStorage pour un brouillon d’annonce venant de la landing (import prévisualisé). */
export const LANDING_CREATE_DRAFT_KEY = 'indiehost:landing:create-draft'

export function cleanText(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

export function asNumber(value: unknown, fallback: number): number {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

export function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function asRecordOrUndefined<T extends Record<string, unknown>>(value: unknown): T | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as T
}

export function deepMerge(target: any, source: any): any {
  if (source === null || source === undefined) return source
  if (Array.isArray(source)) return source
  if (typeof source !== 'object') return source

  const baseValue = target && typeof target === 'object' && !Array.isArray(target) ? target : {}
  const merged: Record<string, any> = { ...baseValue }

  Object.entries(source as Record<string, any>).forEach(
    ([
      key,
      value,
    ]) => {
      if (Array.isArray(value) || value === null || typeof value !== 'object') {
        merged[key] = value
      } else {
        merged[key] = deepMerge(baseValue[key], value)
      }
    },
  )

  return merged
}

export function buildInitialDraft(): RawListingBundle {
  return {
    core: {
      status: 'draft',
      title: '',
      type: '',
      precise_address: '',
      city: '',
      country: '',
      region: '',
      guest_capacity: 1,
      rooms: [],
      amenities: [],
    },
    bookings: {
      price: 0,
      fees: [],
      'booked-days': [],
      reservations: [],
      pricing: {
        deposit: {
          type: 'info',
          amount: 0,
        },
      },
    } as Partial<RawBookings>,
    medias: {
      images: [],
      videos: [],
    },
    arrival: null,
  }
}

export function normalizeDraft(input?: RawListingBundle | null): RawListingBundle {
  const base = buildInitialDraft()
  if (!input) return base

  return {
    ...base,
    ...input,
    core: deepMerge(base.core ?? {}, input.core ?? {}),
    bookings: deepMerge(base.bookings ?? {}, input.bookings ?? {}),
    medias: deepMerge(base.medias ?? {}, input.medias ?? {}),
    arrival: input.arrival ?? base.arrival,
  }
}

export function normalizeBundleForCreate(bundle: RawListingBundle): RawListingBundle {
  const sourceCore = (bundle.core ?? {}) as Partial<RawCore>
  const sourceBookings = (bundle.bookings ?? {}) as Partial<RawBookings>
  const sourceMedias = (bundle.medias ?? {}) as Partial<RawMedias>

  const normalizedCore: Partial<RawCore> = {
    ...sourceCore,
    status: normalizeListingStatus(String(sourceCore.status ?? 'draft')) || 'draft',
    title: cleanText(sourceCore.title) || 'Nouvelle annonce',
    type: cleanText(sourceCore.type),
    precise_address: cleanText(sourceCore.precise_address),
    city: cleanText(sourceCore.city),
    country: cleanText(sourceCore.country),
    region: cleanText(sourceCore.region),
    guest_capacity: Math.max(1, Math.round(asNumber(sourceCore.guest_capacity, 1))),
    amenities: Array.isArray(sourceCore.amenities) ? sourceCore.amenities : [],
    rooms: Array.isArray(sourceCore.rooms) ? sourceCore.rooms : [],
  }

  const latitude = asNumber(sourceCore.latitude ?? sourceCore.lat, Number.NaN)
  const longitude = asNumber(sourceCore.longitude ?? sourceCore.lng, Number.NaN)
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    normalizedCore.latitude = latitude
    normalizedCore.longitude = longitude
    normalizedCore.lat = latitude
    normalizedCore.lng = longitude
    const zoom = asNumber(sourceCore.zoom, Number.NaN)
    normalizedCore.zoom = Number.isFinite(zoom) ? zoom : 13
  }

  const normalizedBookings: Partial<RawBookings> = {
    ...sourceBookings,
    price: Math.max(0, Math.round(asNumber(sourceBookings.price, 0))),
    fees: Array.isArray(sourceBookings.fees) ? sourceBookings.fees : [],
    'booked-days': Array.isArray(sourceBookings['booked-days']) ? sourceBookings['booked-days'] : [],
    reservations: Array.isArray(sourceBookings.reservations) ? sourceBookings.reservations : [],
  }

  const normalizedImages = Array.isArray(sourceMedias.images)
    ? sourceMedias.images
        .filter((image) => typeof image?.src === 'string' && image.src.trim())
        .map((image, index) => ({
          ...image,
          src: image.src.trim(),
          position: typeof image.position === 'number' ? image.position : index,
        }))
    : []

  const normalizedMedias: Partial<RawMedias> = {
    ...sourceMedias,
    images: normalizedImages,
    videos: Array.isArray(sourceMedias.videos) ? sourceMedias.videos : [],
  }

  const payload: RawListingBundle = {
    core: normalizedCore,
    bookings: normalizedBookings,
    medias: normalizedMedias,
  }

  const arrival = asRecordOrUndefined(bundle.arrival)
  const notes = asRecordOrUndefined(bundle.notes)
  const comments = asRecordOrUndefined(bundle.comments)
  const host = asRecordOrUndefined(bundle.host)

  if (arrival) payload.arrival = arrival
  if (notes) payload.notes = notes
  if (comments) payload.comments = comments
  if (host) payload.host = host

  return payload
}
