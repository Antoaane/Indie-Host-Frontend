// File: src/views/Listing/utils/fetchListingRaw.ts

import { getListingsController } from '@/domain/listings/controller'
import {
  isListingIdLike,
  normalizeListingSlug,
} from '@/domain/listings/slug'
import type {
  ListingAvailabilitySyncResult,
  RawBookings,
  RawComments,
  RawCore,
  RawHost,
  RawListingBundle,
  RawArrival,
  RawMedias,
  RawNotes,
} from '@/domain/listings/types'

const controller = getListingsController()
const inflightBundles = new Map<string, Promise<RawListingBundle>>()
const inflightAvailabilitySync = new Map<string, Promise<ListingAvailabilitySyncResult>>()

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

async function resolveListingId(explicitKey?: string): Promise<string> {
  const normalizedExplicitKey = typeof explicitKey === 'string' ? explicitKey.trim() : ''
  if (normalizedExplicitKey) {
    const explicitSlug = normalizeListingSlug(normalizedExplicitKey)
    if (explicitSlug) {
      const listingIdFromSlug = await controller.resolveListingIdBySlug(explicitSlug)
      if (listingIdFromSlug) return listingIdFromSlug
    }

    if (isListingIdLike(normalizedExplicitKey)) {
      return normalizedExplicitKey
    }
  }

  if (typeof window !== 'undefined') {
    const hostnameListingId = await controller.resolveListingIdByHostname(window.location.hostname)
    if (hostnameListingId) return hostnameListingId

    const currentPath = window.location.pathname
    const listingSlugFromRootRoute = currentPath.match(/^\/([^/]+)\/?$/)?.[1]
    if (listingSlugFromRootRoute) {
      const rootSlug = normalizeListingSlug(decodePathSegment(listingSlugFromRootRoute))
      if (rootSlug) {
        const listingIdFromRootSlug = await controller.resolveListingIdBySlug(rootSlug)
        if (listingIdFromRootSlug) return listingIdFromRootSlug
      }
    }

    const listingIdFromLegacyRoute = currentPath.match(/^\/listing\/([^/]+)\/?$/)?.[1]
    if (listingIdFromLegacyRoute && isListingIdLike(listingIdFromLegacyRoute)) return listingIdFromLegacyRoute
  }

  const listings = await controller.fetchListings()
  const fallbackId = listings[0]?.listingId ?? 'default-listing'
  console.log('[fetchListingRaw] fallback listing id', fallbackId)
  return fallbackId
}

async function fetchBundle(listingId: string): Promise<RawListingBundle> {
  if (inflightBundles.has(listingId)) return inflightBundles.get(listingId) as Promise<RawListingBundle>

  console.log('[fetchListingRaw] fetch bundle', { listingId })
  const promise = controller.fetchListingBundle(listingId)
    .finally(() => {
      inflightBundles.delete(listingId)
    })

  inflightBundles.set(listingId, promise)
  return promise
}

export async function loadCore(listingId?: string): Promise<RawCore> {
  const resolved = await resolveListingId(listingId)
  const bundle = await fetchBundle(resolved)
  return (bundle.core ?? { id: resolved }) as RawCore
}

export async function loadBookings(listingId?: string): Promise<RawBookings> {
  const resolved = await resolveListingId(listingId)
  const bundle = await fetchBundle(resolved)
  return (bundle.bookings ?? { price: 0, fees: [], 'booked-days': [] }) as RawBookings
}

export async function loadMedias(listingId?: string): Promise<RawMedias> {
  const resolved = await resolveListingId(listingId)
  const bundle = await fetchBundle(resolved)
  return (bundle.medias ?? { images: [], videos: [] }) as RawMedias
}

export async function loadArrival(listingId?: string): Promise<RawArrival> {
  const resolved = await resolveListingId(listingId)
  const bundle = await fetchBundle(resolved)
  return (bundle.arrival ?? {
    intro: { title: '', subtitle: '', tagline: '' },
    practical: {
      savings: { message: '' },
      access: { address: '', checkIn: '', checkOut: '', parking: '' },
      services: { wifi: '', contacts: '', assistance: '' },
      rules: '',
      shops: '',
    },
    guide: { title: '', content: '' },
  }) as RawArrival
}

export async function loadNotes(listingId?: string): Promise<RawNotes> {
  const resolved = await resolveListingId(listingId)
  const bundle = await fetchBundle(resolved)
  return (bundle.notes ?? { note: null }) as RawNotes
}

export async function loadComments(listingId?: string): Promise<RawComments> {
  const resolved = await resolveListingId(listingId)
  const bundle = await fetchBundle(resolved)
  return (bundle.comments ?? { comments: [] }) as RawComments
}

export async function loadHost(listingId?: string): Promise<RawHost> {
  const resolved = await resolveListingId(listingId)
  const bundle = await fetchBundle(resolved)
  return (bundle.host ?? { name: '', status: '', avatar: '' }) as RawHost
}

export async function refreshListingAvailability(listingId?: string): Promise<ListingAvailabilitySyncResult | null> {
  const resolved = await resolveListingId(listingId)

  if (inflightAvailabilitySync.has(resolved)) {
    return inflightAvailabilitySync.get(resolved) as Promise<ListingAvailabilitySyncResult>
  }

  const promise = controller.syncListingAvailability(resolved)
    .finally(() => {
      inflightAvailabilitySync.delete(resolved)
    })

  inflightAvailabilitySync.set(resolved, promise)

  try {
    return await promise
  } catch (error) {
    console.warn('[fetchListingRaw] refresh availability failed', { listingId: resolved, error })
    return null
  }
}
