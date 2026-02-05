// File: src/domain/local-json/listingsController.ts

import type {
  DraftPatch,
  ListingResourceKey,
  RawBookings,
  RawComments,
  RawCore,
  RawHost,
  RawListingBundle,
  RawMedias,
  RawNotes,
  UserListingCard,
  VolatileBundle,
} from '@/domain/listings/types'
import type { FetchListingsOptions, ListingsController } from '@/domain/listings/controller'

const LOCAL_JSON_BASE = '/__local-json'

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

export function createLocalJsonListingsController(): ListingsController {
  return {
    mode: 'local-json',
    fetchListings: async (options?: FetchListingsOptions): Promise<UserListingCard[]> => {
      const userId = options?.userId
      console.log('[Domain][local-json] fetchListings', { userId })
      const url = userId ? buildUserListingsUrl(userId) : `${LOCAL_JSON_BASE}/listings`
      return requestJson<UserListingCard[]>(url)
    },
    fetchListingBundle: async (listingId: string): Promise<RawListingBundle> => {
      console.log('[Domain][local-json] fetchListingBundle', { listingId })
      const [core, bookings, medias, notes, comments, host] = await Promise.all([
        requestJson<RawCore>(buildListingUrl('core', listingId)),
        requestJson<RawBookings>(buildListingUrl('bookings', listingId)),
        requestJson<RawMedias>(buildListingUrl('medias', listingId)),
        requestJson<RawNotes>(buildListingUrl('notes', listingId)),
        requestJson<RawComments>(buildListingUrl('comments', listingId)),
        requestJson<RawHost>(buildListingUrl('host', listingId)),
      ])

      return { core, bookings, medias, notes, comments, host }
    },
    fetchEditableListingBundle: async (listingId: string): Promise<RawListingBundle> => {
      console.log('[Domain][local-json] fetchEditableListingBundle', { listingId })
      const [core, bookings, medias] = await Promise.all([
        requestJson<RawCore>(buildListingUrl('core', listingId)),
        requestJson<RawBookings>(buildListingUrl('bookings', listingId)),
        requestJson<RawMedias>(buildListingUrl('medias', listingId)),
      ])

      return { core, bookings, medias }
    },
    fetchVolatileListingBundle: async (listingId: string): Promise<VolatileBundle> => {
      console.log('[Domain][local-json] fetchVolatileListingBundle', { listingId })
      const [bookings, notes, comments, host] = await Promise.all([
        requestJson<RawBookings>(buildListingUrl('bookings', listingId)),
        requestJson<RawNotes>(buildListingUrl('notes', listingId)),
        requestJson<RawComments>(buildListingUrl('comments', listingId)),
        requestJson<RawHost>(buildListingUrl('host', listingId)),
      ])

      return { bookings, notes, comments, host }
    },
    patchListingDraft: async (listingId: string, patch: DraftPatch): Promise<void> => {
      console.log('[Domain][local-json] patchListingDraft', { listingId, patch })
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

      if (requests.length) {
        await Promise.all(requests)
      }
    },
    publishListingDraft: async (listingId: string, draft: RawListingBundle): Promise<void> => {
      console.log('[Domain][local-json] publishListingDraft', { listingId, draft })
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

      if (requests.length) {
        await Promise.all(requests)
      }
    },
    createListing: async (payload?: Partial<RawListingBundle>): Promise<{ listingId: string }> => {
      console.log('[Domain][local-json] createListing', { payload })
      return requestJson<{ listingId: string }>(`${LOCAL_JSON_BASE}/listings`, {
        method: 'POST',
        body: JSON.stringify(payload ?? {}),
      })
    },
  }
}
