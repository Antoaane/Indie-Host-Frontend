// File: src/domain/local-json/listingsController.ts

import type {
  DraftPatch,
  ListingAvailabilitySyncResult,
  ListingResourceKey,
  RawBookings,
  RawComments,
  RawCore,
  RawListingBundle,
  RawArrival,
  RawMedias,
  RawNotes,
  UserListingCard,
  VolatileBundle,
} from '@/domain/listings/types'
import type { FetchListingsOptions, ListingsController } from '@/domain/listings/controller'
import { normalizeListingCardsMedia } from '@/domain/listings/cards'
import { normalizeListingSlug } from '@/domain/listings/slug'
import { filterDeletedListings } from '@/domain/listings/status'
import { getCanonicalHost } from '@/domain/listings/host'
import { createRuntimeLocalJsonStore } from '@/domain/local-json/runtimeStore'

const LOCAL_JSON_BASE = '/__local-json'
const USE_HTTP_LOCAL_JSON = import.meta.env.DEV
const runtimeStore = createRuntimeLocalJsonStore()

function resolveUrl(path: string) {
  if (typeof window === 'undefined') return path
  return new URL(path, window.location.origin).toString()
}

function normalizePath(path: string): string {
  if (!path.startsWith('/')) return `/${path}`
  return path
}

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const url = resolveUrl(normalizePath(path))
  const method = options?.method ?? 'GET'
  console.log('[Domain][local-json] request', method, url)

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const text = await response.text()
    console.log('[Domain][local-json] response error', response.status, text)
    throw new Error(`Local JSON request failed (${response.status})`)
  }

  return (await response.json()) as T
}

const buildListingUrl = (resource: ListingResourceKey, listingId: string) =>
  `${LOCAL_JSON_BASE}/listings/${resource}/${listingId}`

const buildUserListingsUrl = (userId: string) => `${LOCAL_JSON_BASE}/user/${userId}/listings`
const buildResolveListingSlugUrl = (slug: string) =>
  `${LOCAL_JSON_BASE}/listings/resolve?slug=${encodeURIComponent(slug)}`

async function runWithRuntimeFallback<T>({
  label,
  http,
  runtime,
}: {
  label: string
  http: () => Promise<T>
  runtime: () => T | Promise<T>
}): Promise<T> {
  if (!USE_HTTP_LOCAL_JSON) {
    return await runtime()
  }

  try {
    return await http()
  } catch (error) {
    console.warn(`[Domain][local-json] ${label} fallback to bundled runtime store`, error)
    return await runtime()
  }
}

export function createLocalJsonListingsController(): ListingsController {
  return {
    mode: 'local-json',
    fetchListings: async (options?: FetchListingsOptions): Promise<UserListingCard[]> => {
      const userId = options?.userId
      console.log('[Domain][local-json] fetchListings', { userId })
      return runWithRuntimeFallback({
        label: 'fetchListings',
        http: async () => {
          const url = userId ? buildUserListingsUrl(userId) : `${LOCAL_JSON_BASE}/listings`
          const listings = await requestJson<UserListingCard[]>(url)
          return filterDeletedListings(normalizeListingCardsMedia(listings), options?.includeDeleted)
        },
        runtime: () => filterDeletedListings(normalizeListingCardsMedia(runtimeStore.listListings()), options?.includeDeleted),
      })
    },
    resolveListingIdByHostname: async (): Promise<string | null> => {
      return null
    },
    resolveListingIdBySlug: async (slug: string): Promise<string | null> => {
      const normalizedSlug = normalizeListingSlug(slug)
      if (!normalizedSlug) return null

      return runWithRuntimeFallback({
        label: 'resolveListingIdBySlug',
        http: async () => {
          const resolved = await requestJson<{ listingId?: string | null }>(buildResolveListingSlugUrl(normalizedSlug))
          const listingId = typeof resolved?.listingId === 'string' ? resolved.listingId.trim() : ''
          return listingId || null
        },
        runtime: () => runtimeStore.resolveListingIdBySlug(normalizedSlug),
      })
    },
    fetchListingBundle: async (listingId: string): Promise<RawListingBundle> => {
      console.log('[Domain][local-json] fetchListingBundle', { listingId })
      return runWithRuntimeFallback({
        label: 'fetchListingBundle',
        http: async (): Promise<RawListingBundle> => {
          const [core, bookings, medias, arrival, notes, comments] = await Promise.all([
            requestJson<RawCore>(buildListingUrl('core', listingId)),
            requestJson<RawBookings>(buildListingUrl('bookings', listingId)),
            requestJson<RawMedias>(buildListingUrl('medias', listingId)),
            requestJson<RawArrival>(buildListingUrl('arrival', listingId)),
            requestJson<RawNotes>(buildListingUrl('notes', listingId)),
            requestJson<RawComments>(buildListingUrl('comments', listingId)),
          ])

          return { core, bookings, medias, arrival, notes, comments, host: getCanonicalHost() }
        },
        runtime: () => runtimeStore.getBundle(listingId),
      })
    },
    fetchEditableListingBundle: async (listingId: string): Promise<RawListingBundle> => {
      console.log('[Domain][local-json] fetchEditableListingBundle', { listingId })
      return runWithRuntimeFallback({
        label: 'fetchEditableListingBundle',
        http: async (): Promise<RawListingBundle> => {
          const [core, bookings, medias, arrival] = await Promise.all([
            requestJson<RawCore>(buildListingUrl('core', listingId)),
            requestJson<RawBookings>(buildListingUrl('bookings', listingId)),
            requestJson<RawMedias>(buildListingUrl('medias', listingId)),
            requestJson<RawArrival>(buildListingUrl('arrival', listingId)),
          ])

          return { core, bookings, medias, arrival }
        },
        runtime: () => runtimeStore.getEditableBundle(listingId),
      })
    },
    fetchVolatileListingBundle: async (listingId: string): Promise<VolatileBundle> => {
      console.log('[Domain][local-json] fetchVolatileListingBundle', { listingId })
      return runWithRuntimeFallback({
        label: 'fetchVolatileListingBundle',
        http: async (): Promise<VolatileBundle> => {
          const [bookings, notes, comments] = await Promise.all([
            requestJson<RawBookings>(buildListingUrl('bookings', listingId)),
            requestJson<RawNotes>(buildListingUrl('notes', listingId)),
            requestJson<RawComments>(buildListingUrl('comments', listingId)),
          ])

          return { bookings, notes, comments, host: getCanonicalHost() }
        },
        runtime: () => runtimeStore.getVolatileBundle(listingId),
      })
    },
    syncListingAvailability: async (listingId: string): Promise<ListingAvailabilitySyncResult> => {
      console.log('[Domain][local-json] syncListingAvailability', { listingId })
      return {
        listingId,
        refreshedAt: new Date().toISOString(),
        hasSources: false,
        availabilityUpdated: false,
        syncedSources: 0,
        throttledSources: 0,
        failedSources: 0,
        skippedSources: 0,
        sources: [],
      }
    },
    patchListingDraft: async (listingId: string, patch: DraftPatch): Promise<void> => {
      console.log('[Domain][local-json] patchListingDraft', { listingId, patch })
      if (!USE_HTTP_LOCAL_JSON) {
        runtimeStore.patchDraft(listingId, patch)
        return
      }

      const requests: Promise<unknown>[] = []

      if (patch.core) {
        requests.push(
          requestJson<RawCore>(buildListingUrl('core', listingId), {
            method: 'PATCH',
            body: JSON.stringify(patch.core),
          }),
        )
      }

      if (patch.bookings) {
        requests.push(
          requestJson<RawBookings>(buildListingUrl('bookings', listingId), {
            method: 'PATCH',
            body: JSON.stringify(patch.bookings),
          }),
        )
      }

      if (patch.medias) {
        requests.push(
          requestJson<RawMedias>(buildListingUrl('medias', listingId), {
            method: 'PATCH',
            body: JSON.stringify(patch.medias),
          }),
        )
      }

      if (patch.arrival) {
        requests.push(
          requestJson<RawArrival>(buildListingUrl('arrival', listingId), {
            method: 'PATCH',
            body: JSON.stringify(patch.arrival),
          }),
        )
      }

      if (patch.notes) {
        requests.push(
          requestJson<RawNotes>(buildListingUrl('notes', listingId), {
            method: 'PATCH',
            body: JSON.stringify(patch.notes),
          }),
        )
      }

      if (patch.comments) {
        requests.push(
          requestJson<RawComments>(buildListingUrl('comments', listingId), {
            method: 'PATCH',
            body: JSON.stringify(patch.comments),
          }),
        )
      }

      try {
        if (requests.length) {
          await Promise.all(requests)
        }
        runtimeStore.patchDraft(listingId, patch)
      } catch (error) {
        console.warn('[Domain][local-json] patchListingDraft fallback to bundled runtime store', error)
        runtimeStore.patchDraft(listingId, patch)
      }
    },
    publishListingDraft: async (listingId: string, draft: RawListingBundle): Promise<void> => {
      console.log('[Domain][local-json] publishListingDraft', { listingId, draft })
      if (!USE_HTTP_LOCAL_JSON) {
        runtimeStore.publishDraft(listingId, draft)
        return
      }

      const requests: Promise<unknown>[] = []

      if (draft.core) {
        requests.push(
          requestJson<RawCore>(buildListingUrl('core', listingId), {
            method: 'PATCH',
            body: JSON.stringify(draft.core),
          }),
        )
      }

      if (draft.bookings) {
        requests.push(
          requestJson<RawBookings>(buildListingUrl('bookings', listingId), {
            method: 'PATCH',
            body: JSON.stringify(draft.bookings),
          }),
        )
      }

      if (draft.medias) {
        requests.push(
          requestJson<RawMedias>(buildListingUrl('medias', listingId), {
            method: 'PATCH',
            body: JSON.stringify(draft.medias),
          }),
        )
      }

      if (draft.arrival) {
        requests.push(
          requestJson<RawArrival>(buildListingUrl('arrival', listingId), {
            method: 'PATCH',
            body: JSON.stringify(draft.arrival),
          }),
        )
      }

      try {
        if (requests.length) {
          await Promise.all(requests)
        }
        runtimeStore.publishDraft(listingId, draft)
      } catch (error) {
        console.warn('[Domain][local-json] publishListingDraft fallback to bundled runtime store', error)
        runtimeStore.publishDraft(listingId, draft)
      }
    },
    createListing: async (payload?: Partial<RawListingBundle>): Promise<{ listingId: string }> => {
      console.log('[Domain][local-json] createListing', { payload })
      return runWithRuntimeFallback({
        label: 'createListing',
        http: () => requestJson<{ listingId: string }>(`${LOCAL_JSON_BASE}/listings`, {
          method: 'POST',
          body: JSON.stringify(payload ?? {}),
        }),
        runtime: () => runtimeStore.createListing(payload),
      })
    },
  }
}
