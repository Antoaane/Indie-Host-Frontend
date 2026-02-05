// File: src/domain/api/listingsController.ts

import clerkToken from '@/utils/clerkToken'
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

const RAW_BASE_API_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim()
const BASE_API_URL = normalizeApiBaseUrl(RAW_BASE_API_URL)

function normalizeApiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/$/, '')
  if (!trimmed) return ''

  if (import.meta.env.DEV) {
    try {
      const parsed = new URL(trimmed)
      return parsed.pathname.replace(/\/$/, '') || '/'
    } catch {
      // ignore: base URL may be relative (e.g. /v1)
    }
  }

  return trimmed
}

function resolveUrl(url: string) {
  if (typeof window === 'undefined') return url
  return new URL(url, window.location.origin).toString()
}

const buildListingUrl = (resource: ListingResourceKey, listingId: string) =>
  `${BASE_API_URL}/listings/${resource}/${listingId}`

const buildUserListingsUrl = (userId: string) => `${BASE_API_URL}/user/${userId}/listings`
const buildCreateListingUrl = () => `${BASE_API_URL}/listings`

function waitForClerkToken({ timeoutMs, pollEveryMs }: { timeoutMs: number; pollEveryMs: number }): Promise<string | null> {
  const startedAt = Date.now()

  return new Promise((resolve) => {
    const tick = () => {
      const token = (clerkToken.value ?? '').trim()
      if (token) return resolve(token)
      if (Date.now() - startedAt >= timeoutMs) return resolve(null)
      setTimeout(tick, pollEveryMs)
    }

    tick()
  })
}

async function getAxios() {
  const { default: axios } = await import('axios')
  return axios
}

async function getAuthToken(): Promise<string | null> {
  const token = (clerkToken.value ?? '').trim()
  if (token) return token
  return waitForClerkToken({ timeoutMs: 2000, pollEveryMs: 50 })
}

async function fetchRemote<T>(url: string): Promise<T> {
  const axios = await getAxios()
  const token = await getAuthToken()

  const { data } = await axios.get<T>(url, {
    withCredentials: false,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })

  return data
}

async function patchRemote<T>(url: string, payload: unknown): Promise<T> {
  const axios = await getAxios()
  const token = await getAuthToken()

  const { data } = await axios.patch<T>(url, payload, {
    withCredentials: false,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })

  return data
}

async function postRemote<T>(url: string, payload: unknown): Promise<T> {
  const axios = await getAxios()
  const token = await getAuthToken()

  const { data } = await axios.post<T>(url, payload, {
    withCredentials: false,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })

  return data
}

function fallbackEditableBundle(listingId: string): RawListingBundle {
  return {
    core: { id: listingId },
    bookings: { price: 0, fees: [], 'booked-days': [] },
    medias: { images: [], videos: [] },
  }
}

function fallbackVolatileBundle(): VolatileBundle {
  return { bookings: null, notes: null, comments: null, host: null }
}

export function createApiListingsController(): ListingsController {
  const apiEnabled = Boolean(BASE_API_URL)
  if (!apiEnabled) {
    console.log('[Domain][api] VITE_API_BASE_URL missing: using mock responses')
  }

  return {
    mode: 'api',
    fetchListings: async (options?: FetchListingsOptions): Promise<UserListingCard[]> => {
      const userId = options?.userId
      console.log('[Domain][api] fetchListings', { userId })

      if (!apiEnabled) return []
      if (!userId) return []

      const url = resolveUrl(buildUserListingsUrl(userId))
      return fetchRemote<UserListingCard[]>(url)
    },
    fetchListingBundle: async (listingId: string): Promise<RawListingBundle> => {
      console.log('[Domain][api] fetchListingBundle', { listingId })
      if (!apiEnabled) return fallbackEditableBundle(listingId)

      const [core, bookings, medias, notes, comments, host] = await Promise.all([
        fetchRemote<RawCore>(resolveUrl(buildListingUrl('core', listingId))),
        fetchRemote<RawBookings>(resolveUrl(buildListingUrl('bookings', listingId))),
        fetchRemote<RawMedias>(resolveUrl(buildListingUrl('medias', listingId))),
        fetchRemote<RawNotes>(resolveUrl(buildListingUrl('notes', listingId))),
        fetchRemote<RawComments>(resolveUrl(buildListingUrl('comments', listingId))),
        fetchRemote<RawHost>(resolveUrl(buildListingUrl('host', listingId))),
      ])

      return { core, bookings, medias, notes, comments, host }
    },
    fetchEditableListingBundle: async (listingId: string): Promise<RawListingBundle> => {
      console.log('[Domain][api] fetchEditableListingBundle', { listingId })
      if (!apiEnabled) return fallbackEditableBundle(listingId)

      const [core, bookings, medias] = await Promise.all([
        fetchRemote<RawCore>(resolveUrl(buildListingUrl('core', listingId))),
        fetchRemote<RawBookings>(resolveUrl(buildListingUrl('bookings', listingId))),
        fetchRemote<RawMedias>(resolveUrl(buildListingUrl('medias', listingId))),
      ])

      return { core, bookings, medias }
    },
    fetchVolatileListingBundle: async (listingId: string): Promise<VolatileBundle> => {
      console.log('[Domain][api] fetchVolatileListingBundle', { listingId })
      if (!apiEnabled) return fallbackVolatileBundle()

      const [bookings, notes, comments, host] = await Promise.all([
        fetchRemote<RawBookings>(resolveUrl(buildListingUrl('bookings', listingId))),
        fetchRemote<RawNotes>(resolveUrl(buildListingUrl('notes', listingId))),
        fetchRemote<RawComments>(resolveUrl(buildListingUrl('comments', listingId))),
        fetchRemote<RawHost>(resolveUrl(buildListingUrl('host', listingId))),
      ])

      return { bookings, notes, comments, host }
    },
    patchListingDraft: async (listingId: string, patch: DraftPatch): Promise<void> => {
      console.log('[Domain][api] patchListingDraft', { listingId, patch })
      if (!apiEnabled) return

      const requests: Promise<unknown>[] = []

      if (patch.core) {
        requests.push(patchRemote(resolveUrl(buildListingUrl('core', listingId)), patch.core))
      }

      if (patch.bookings) {
        requests.push(patchRemote(resolveUrl(buildListingUrl('bookings', listingId)), patch.bookings))
      }

      if (patch.medias) {
        requests.push(patchRemote(resolveUrl(buildListingUrl('medias', listingId)), patch.medias))
      }

      if (requests.length) {
        await Promise.all(requests)
      }
    },
    publishListingDraft: async (listingId: string, draft: RawListingBundle): Promise<void> => {
      console.log('[Domain][api] publishListingDraft', { listingId, draft })
      if (!apiEnabled) return

      const requests: Promise<unknown>[] = []

      if (draft.core) {
        requests.push(patchRemote(resolveUrl(buildListingUrl('core', listingId)), draft.core))
      }

      if (draft.bookings) {
        requests.push(patchRemote(resolveUrl(buildListingUrl('bookings', listingId)), draft.bookings))
      }

      if (draft.medias) {
        requests.push(patchRemote(resolveUrl(buildListingUrl('medias', listingId)), draft.medias))
      }

      if (requests.length) {
        await Promise.all(requests)
      }
    },
    createListing: async (payload?: Partial<RawListingBundle>): Promise<{ listingId: string }> => {
      console.log('[Domain][api] createListing', { payload })
      if (!apiEnabled) return { listingId: 'listing-mock' }

      const url = resolveUrl(buildCreateListingUrl())
      return postRemote<{ listingId: string }>(url, payload ?? {})
    },
  }
}
