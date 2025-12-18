// File: src/views/Editor/utils/listingApi.ts

import coreJSON from '@/content/fr/ListingTest_0/core.json'
import mediasJSON from '@/content/fr/ListingTest_0/medias.json'
import bookingsJSON from '@/content/fr/ListingTest_0/bookings.json'
import notesJSON from '@/content/fr/ListingTest_0/notes.json'
import commentsJSON from '@/content/fr/ListingTest_0/comments.json'
import hostJSON from '@/content/fr/ListingTest_0/host.json'

import clerkToken from '@/utils/clerkToken'

import type { RawBookings, RawComments, RawCore, RawHost, RawMedias, RawNotes } from '@/views/Listing/utils/fetchListingRaw'
import type { RawListingBundle } from '@/views/ListingView/utils/useParseContent'

export type DraftPatch = {
  core?: Partial<RawCore> | null
  medias?: Partial<RawMedias> | null
}

export type VolatileBundle = Pick<RawListingBundle, 'bookings' | 'notes' | 'comments' | 'host'>

export type UserListingCard = {
  listingId: string
  title?: string
  status?: string
  coverSrc?: string
  images?: Array<{
    src: string
    alt?: string
    position?: number
    index?: number
  }>
  guestCapacity?: number
  pricePerNight?: number
  rating?: number
}

type ListingResourceKey = 'core' | 'medias' | 'bookings' | 'notes' | 'comments' | 'host'

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

const buildListingUrl = (resource: ListingResourceKey, listingId: string) =>
  `${BASE_API_URL}/listings/${resource}/${listingId}`

const buildUserListingsUrl = (userId: string) => `${BASE_API_URL}/user/${userId}/listings`

function waitForClerkToken({
  timeoutMs,
  pollEveryMs,
}: {
  timeoutMs: number
  pollEveryMs: number
}): Promise<string | null> {
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

function resolveUrl(url: string) {
  if (typeof window === 'undefined') return url
  return new URL(url, window.location.origin).toString()
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

function fallbackEditableBundle(listingId: string): RawListingBundle {
  if (listingId === coreJSON.id) {
    return {
      core: coreJSON as unknown as RawListingBundle['core'],
      medias: mediasJSON as unknown as RawListingBundle['medias'],
    }
  }

  return {
    core: { id: listingId },
    medias: { images: [], videos: [] },
  }
}

function fallbackVolatileBundle(listingId: string): VolatileBundle {
  if (listingId === coreJSON.id) {
    return {
      bookings: bookingsJSON as unknown as RawListingBundle['bookings'],
      notes: notesJSON as unknown as RawListingBundle['notes'],
      comments: commentsJSON as unknown as RawListingBundle['comments'],
      host: hostJSON as unknown as RawListingBundle['host'],
    }
  }

  return { bookings: null, notes: null, comments: null, host: null }
}

export async function fetchEditableListingBundle(listingId: string): Promise<RawListingBundle> {
  if (!BASE_API_URL) return fallbackEditableBundle(listingId)

  try {
    const [core, medias] = await Promise.all([
      fetchRemote<RawCore>(resolveUrl(buildListingUrl('core', listingId))),
      fetchRemote<RawMedias>(resolveUrl(buildListingUrl('medias', listingId))),
    ])

    return { core, medias }
  } catch (err) {
    console.warn('[Editor][listingApi] fetchEditableListingBundle fallback', err)
    return fallbackEditableBundle(listingId)
  }
}

export async function fetchVolatileListingBundle(listingId: string): Promise<VolatileBundle> {
  if (!BASE_API_URL) return fallbackVolatileBundle(listingId)

  try {
    const [bookings, notes, comments, host] = await Promise.all([
      fetchRemote<RawBookings>(resolveUrl(buildListingUrl('bookings', listingId))),
      fetchRemote<RawNotes>(resolveUrl(buildListingUrl('notes', listingId))),
      fetchRemote<RawComments>(resolveUrl(buildListingUrl('comments', listingId))),
      fetchRemote<RawHost>(resolveUrl(buildListingUrl('host', listingId))),
    ])

    return { bookings, notes, comments, host }
  } catch (err) {
    console.warn('[Editor][listingApi] fetchVolatileListingBundle fallback', err)
    return fallbackVolatileBundle(listingId)
  }
}

export async function fetchUserListings(userId: string): Promise<UserListingCard[]> {
  if (!BASE_API_URL) {
    return [
      {
        listingId: coreJSON.id,
        title: coreJSON.title,
        status: coreJSON.status,
        coverSrc: mediasJSON.images?.[0]?.src,
        images: mediasJSON.images as UserListingCard['images'],
        guestCapacity: coreJSON.guest_capacity,
        pricePerNight: bookingsJSON.price,
        rating: notesJSON.note?.note,
      },
    ]
  }

  const url = resolveUrl(buildUserListingsUrl(userId))
  const raw = await fetchRemote<unknown>(url)

  if (!Array.isArray(raw)) return []

  const parseImages = (value: unknown): UserListingCard['images'] => {
    if (!Array.isArray(value)) return undefined

    const items = value
      .map((entry, index) => {
        if (typeof entry === 'string') {
          return { src: entry, alt: '', index } satisfies NonNullable<UserListingCard['images']>[number]
        }

        if (!entry || typeof entry !== 'object') return null
        const record = entry as Record<string, unknown>
        const src = record['src'] as string | undefined
        if (!src) return null

        return {
          src,
          alt: (record['alt'] as string | undefined) ?? '',
          position: typeof record['position'] === 'number' ? record['position'] : undefined,
          index: typeof record['index'] === 'number' ? record['index'] : index,
        } satisfies NonNullable<UserListingCard['images']>[number]
      })
      .filter((img): img is NonNullable<UserListingCard['images']>[number] => Boolean(img))

    return items.length ? items : undefined
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const listingId =
        (record['listing-id'] as string | undefined) ??
        (record['listingId'] as string | undefined) ??
        (record['id'] as string | undefined) ??
        ''

      if (!listingId) return null

      return {
        listingId,
        title: record.title as string | undefined,
        status: record.status as string | undefined,
        coverSrc:
          (record.coverSrc as string | undefined) ??
          (record.cover as string | undefined) ??
          (record['cover-src'] as string | undefined),
        images:
          parseImages(record.images) ??
          parseImages((record.medias as Record<string, unknown> | undefined)?.images) ??
          parseImages((record['medias'] as Record<string, unknown> | undefined)?.['images']),
        guestCapacity: typeof record.guest_capacity === 'number' ? record.guest_capacity : undefined,
        pricePerNight: typeof record.price === 'number' ? record.price : undefined,
        rating: typeof record.rating === 'number' ? record.rating : undefined,
      } satisfies UserListingCard
    })
    .filter((item): item is UserListingCard => Boolean(item))
}

export async function publishListingDraft(listingId: string, draft: RawListingBundle) {
  if (!BASE_API_URL) return

  const requests: Promise<unknown>[] = []

  if (draft.core) {
    requests.push(
      patchRemote(resolveUrl(buildListingUrl('core', listingId)), draft.core),
    )
  }

  if (draft.medias) {
    requests.push(
      patchRemote(resolveUrl(buildListingUrl('medias', listingId)), draft.medias),
    )
  }

  await Promise.all(requests)
}
