// File: src/domain/api/listingsController.ts

import clerkToken from '@/utils/clerkToken'
import type {
  DraftPatch,
  ListingAvailabilitySyncResult,
  ListingResourceKey,
  RawBookings,
  RawComments,
  RawCore,
  RawHost,
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
import { ensurePublishedMediasStoredInImageKit } from '@/domain/api/imagekit'

const RAW_BASE_API_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim()
const BASE_API_URL = normalizeApiBaseUrl(RAW_BASE_API_URL)
const API_REQUEST_TIMEOUT_MS = resolveRequestTimeoutMs(import.meta.env.VITE_API_REQUEST_TIMEOUT_MS, 20000)
const AUTH_TOKEN_MIN_VALIDITY_MS = 60_000

function resolveRequestTimeoutMs(rawValue: unknown, fallback: number): number {
  const parsed = Number(rawValue)
  if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed)
  return fallback
}

function normalizeApiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/$/, '')
  if (!trimmed) return ''
  return trimmed
}

function resolveUrl(url: string) {
  if (typeof window === 'undefined') return url
  return new URL(url, window.location.origin).toString()
}

const buildListingUrl = (resource: ListingResourceKey, listingId: string) =>
  `${BASE_API_URL}/listings/${resource}/${listingId}`

const buildUserListingsUrl = (userId: string) => `${BASE_API_URL}/user/${userId}/listings`
const buildLegacyMyListingsUrl = () => `${BASE_API_URL}/user/me/listings`
const buildMyListingsUrl = () => `${BASE_API_URL}/users/me/listings`
const buildAdminListingsUrl = () => `${BASE_API_URL}/users/admin/listings`
const buildListingBundleUrl = (listingId: string) => `${BASE_API_URL}/listings/bundle/${listingId}`
const buildCreateListingUrl = () => `${BASE_API_URL}/listings`
const buildResolveListingHostnameUrl = (hostname: string, listingSlug?: string | null) => {
  const params = new URLSearchParams({
    hostname: hostname.trim(),
  })
  const normalizedListingSlug = (listingSlug ?? '').trim()
  if (normalizedListingSlug) {
    params.set('listingSlug', normalizedListingSlug)
  }
  return `${BASE_API_URL}/listings/domains/resolve?${params.toString()}`
}
const buildResolveListingSlugUrl = (slug: string) =>
  `${BASE_API_URL}/listings/resolve?slug=${encodeURIComponent(slug.trim())}`
const buildListingAvailabilityRefreshUrl = (listingId: string) => `${BASE_API_URL}/calendar/listings/${listingId}/refresh`

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

function readJwtPayload(token: string): Record<string, unknown> | null {
  const encodedPayload = token.split('.')[1]
  if (!encodedPayload) return null

  try {
    const padded = encodedPayload
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(encodedPayload.length / 4) * 4, '=')

    const payload = JSON.parse(window.atob(padded))
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
    return payload as Record<string, unknown>
  } catch {
    return null
  }
}

function hasValidLifetime(token: string, minValidityMs = AUTH_TOKEN_MIN_VALIDITY_MS): boolean {
  if (typeof window === 'undefined' || typeof window.atob !== 'function') return true

  const payload = readJwtPayload(token)
  if (!payload) return true

  const exp = payload.exp
  if (typeof exp !== 'number' || !Number.isFinite(exp)) return true

  const remainingMs = exp * 1000 - Date.now()
  return remainingMs > minValidityMs
}

function readToken(): string | null {
  const token = (clerkToken.value ?? '').trim()
  if (!token) return null
  if (!hasValidLifetime(token)) {
    clerkToken.value = null
    return null
  }
  return token
}

async function readFreshTokenFromClerkRuntime(options?: { skipCache?: boolean }): Promise<string | null> {
  if (typeof window === 'undefined') return null

  const clerk = (window as Window & {
    Clerk?: {
      session?: {
        getToken?: (options?: { skipCache?: boolean }) => Promise<string | null>
      }
    }
  }).Clerk

  const getSessionToken = clerk?.session?.getToken
  if (typeof getSessionToken !== 'function') return null

  try {
    const token = (await getSessionToken(options?.skipCache ? { skipCache: true } : undefined))?.trim() ?? ''
    if (!token) return null
    if (!hasValidLifetime(token)) {
      if (!options?.skipCache) return readFreshTokenFromClerkRuntime({ skipCache: true })
      return null
    }
    clerkToken.value = token
    return token
  } catch {
    return null
  }
}

async function getAuthToken(options?: { waitForReady?: boolean }): Promise<string | null> {
  const token = readToken()
  if (token) return token

  const freshToken = await readFreshTokenFromClerkRuntime()
  if (freshToken) return freshToken

  if (!options?.waitForReady) return null

  const waitedToken = await waitForClerkToken({ timeoutMs: 2000, pollEveryMs: 50 })
  if (!waitedToken) return null
  if (!hasValidLifetime(waitedToken)) {
    clerkToken.value = null
    return readFreshTokenFromClerkRuntime({ skipCache: true })
  }
  return waitedToken
}

function buildAuthHeaders(token: string | null) {
  return token ? { Authorization: `Bearer ${token}` } : undefined
}

function readHttpStatus(error: unknown): number | null {
  const status = (error as { response?: { status?: unknown } })?.response?.status
  if (typeof status === 'number' && Number.isFinite(status)) return status
  return null
}

function readJwtSubject(token: string | null): string | null {
  if (!token || typeof window === 'undefined' || typeof window.atob !== 'function') return null

  const payload = readJwtPayload(token)
  const subject = typeof payload?.sub === 'string' ? payload.sub.trim() : ''
  return subject || null
}

async function fetchRemoteWithToken<T>(url: string, token: string | null): Promise<T> {
  const axios = await getAxios()

  try {
    const { data } = await axios.get<T>(url, {
      withCredentials: false,
      timeout: API_REQUEST_TIMEOUT_MS,
      headers: buildAuthHeaders(token),
    })

    return data
  } catch (error) {
    if (readHttpStatus(error) === 401) {
      const refreshedToken = await readFreshTokenFromClerkRuntime({ skipCache: true })
      if (refreshedToken) {
        const { data } = await axios.get<T>(url, {
          withCredentials: false,
          timeout: API_REQUEST_TIMEOUT_MS,
          headers: buildAuthHeaders(refreshedToken),
        })
        return data
      }
    }

    throw error
  }
}

async function fetchRemote<T>(url: string): Promise<T> {
  const token = await getAuthToken()
  return fetchRemoteWithToken<T>(url, token)
}

async function patchRemoteWithToken<T>(url: string, payload: unknown, token: string | null): Promise<T> {
  const axios = await getAxios()
  const requestToken = token ?? await readFreshTokenFromClerkRuntime({ skipCache: true })

  try {
    const { data } = await axios.patch<T>(url, payload, {
      withCredentials: false,
      timeout: API_REQUEST_TIMEOUT_MS,
      headers: buildAuthHeaders(requestToken),
    })

    return data
  } catch (error) {
    if (readHttpStatus(error) === 401) {
      const refreshedToken = await readFreshTokenFromClerkRuntime({ skipCache: true })
      if (refreshedToken) {
        const { data } = await axios.patch<T>(url, payload, {
          withCredentials: false,
          timeout: API_REQUEST_TIMEOUT_MS,
          headers: buildAuthHeaders(refreshedToken),
        })
        return data
      }
    }

    throw error
  }
}

async function postRemoteWithToken<T>(url: string, payload: unknown, token: string | null): Promise<T> {
  const axios = await getAxios()
  const requestToken = token ?? await readFreshTokenFromClerkRuntime({ skipCache: true })

  try {
    const { data } = await axios.post<T>(url, payload, {
      withCredentials: false,
      timeout: API_REQUEST_TIMEOUT_MS,
      headers: buildAuthHeaders(requestToken),
    })

    return data
  } catch (error) {
    if (readHttpStatus(error) === 401) {
      const refreshedToken = await readFreshTokenFromClerkRuntime({ skipCache: true })
      if (refreshedToken) {
        const { data } = await axios.post<T>(url, payload, {
          withCredentials: false,
          timeout: API_REQUEST_TIMEOUT_MS,
          headers: buildAuthHeaders(refreshedToken),
        })
        return data
      }
    }

    throw error
  }
}

async function postRemote<T>(url: string, payload: unknown): Promise<T> {
  const token = await getAuthToken({ waitForReady: true })
  return postRemoteWithToken<T>(url, payload, token)
}

async function postRemotePublic<T>(url: string, payload: unknown): Promise<T> {
  const axios = await getAxios()
  const { data } = await axios.post<T>(url, payload, {
    withCredentials: false,
    timeout: API_REQUEST_TIMEOUT_MS,
  })
  return data
}

function fallbackEditableBundle(listingId: string): RawListingBundle {
  return {
    core: { id: listingId },
    bookings: { price: 0, fees: [], 'booked-days': [], reservations: [] },
    medias: { images: [], videos: [] },
    arrival: {
      intro: {
        title: 'Bienvenue',
        subtitle: 'Pour profiter des lieux au maximum, voici votre guide d’arrivée.',
        tagline: 'Propulsé par IndieHost',
      },
      practical: {
        savings: {
          message: 'Réservez en direct pour éviter les commissions.',
        },
        access: {
          address: 'Baurech, Nouvelle-Aquitaine (adresse complète envoyée 24h avant l’arrivée).',
          checkIn: 'À partir de 16h — arrivée autonome possible.',
          checkOut: 'Avant 11h — merci de laisser les clés au point indiqué.',
          parking: 'Gratuit sur place (1 à 2 véhicules).',
        },
        services: {
          wifi: 'Nom du réseau et mot de passe disponibles sur place.',
          contacts: 'Urgences 112 · Médecin 15 · Police 17.',
          assistance: 'Assistance hôte disponible de 9h à 21h par message.',
        },
        rules:
          '<ul>\\n  <li><strong>Respect de la nature</strong> — merci de ne rien laisser sur place et de trier vos déchets.</li>\\n  <li><strong>Silence</strong> — après 22h, merci de préserver la quiétude des lieux.</li>\\n  <li><strong>Départ</strong> — laissez le logement dans l’état trouvé et fermez bien.</li>\\n</ul>',
        shops:
          '<ul>\\n  <li><strong>Épicerie</strong> — à 10 minutes en voiture (produits frais et locaux).</li>\\n  <li><strong>Marché</strong> — le samedi matin, idéal pour découvrir la région.</li>\\n</ul>',
      },
      guide: {
        title: '',
        content: '',
      },
    },
  }
}

type ListingHostnameResolution = {
  listingId: string
}

export function createApiListingsController(): ListingsController {
  const apiEnabled = Boolean(BASE_API_URL)
  const apiDisabledErrorPrefix = '[Domain][api] Missing VITE_API_BASE_URL.'
  if (!apiEnabled) {
    console.error(`${apiDisabledErrorPrefix} API calls are disabled.`)
  }

  function assertApiEnabled(operation: string) {
    if (apiEnabled) return
    throw new Error(`${apiDisabledErrorPrefix} Impossible de ${operation}.`)
  }

  function readResolvedListingId(payload: unknown): string | null {
    const listingId = (payload as { listingId?: unknown })?.listingId
    if (typeof listingId !== 'string') return null
    const trimmed = listingId.trim()
    return trimmed || null
  }

  async function resolveListingIdBySlug(slug: string): Promise<string | null> {
    const normalizedSlug = normalizeListingSlug(slug)
    if (!apiEnabled || !normalizedSlug) return null

    const url = resolveUrl(buildResolveListingSlugUrl(normalizedSlug))

    try {
      const result = await fetchRemote<ListingHostnameResolution>(url)
      return readResolvedListingId(result)
    } catch (error) {
      const status = readHttpStatus(error)
      if (status === 400 || status === 401 || status === 403 || status === 404) {
        return null
      }
      console.warn('[Domain][api] resolveListingIdBySlug failed', { slug: normalizedSlug, error })
      return null
    }
  }

  return {
    mode: 'api',
    fetchListings: async (options?: FetchListingsOptions): Promise<UserListingCard[]> => {
      const userId = options?.userId
      const adminViewAll = Boolean(options?.adminViewAll)
      console.log('[Domain][api] fetchListings', { userId, adminViewAll })

      assertApiEnabled('charger les annonces')
      const token = await getAuthToken({ waitForReady: true })
      if (!token) return []

      if (adminViewAll) {
        try {
          const listings = await fetchRemoteWithToken<UserListingCard[]>(
            resolveUrl(buildAdminListingsUrl()),
            token,
          )
          return filterDeletedListings(normalizeListingCardsMedia(listings), options?.includeDeleted)
        } catch (error) {
          const status = readHttpStatus(error)
          if (status !== 401 && status !== 403 && status !== 404) {
            throw error
          }
        }
      }

      try {
        const listings = await fetchRemoteWithToken<UserListingCard[]>(resolveUrl(buildMyListingsUrl()), token)
        return filterDeletedListings(normalizeListingCardsMedia(listings), options?.includeDeleted)
      } catch (error) {
        const status = readHttpStatus(error)
        if (status === 404) {
          const fallbackUserId = userId ?? readJwtSubject(token)
          if (fallbackUserId) {
            try {
              const listings = await fetchRemoteWithToken<UserListingCard[]>(
                resolveUrl(buildUserListingsUrl(fallbackUserId)),
                token,
              )
              return filterDeletedListings(normalizeListingCardsMedia(listings), options?.includeDeleted)
            } catch (fallbackByUserIdError) {
              const fallbackByUserIdStatus = readHttpStatus(fallbackByUserIdError)
              if (fallbackByUserIdStatus !== 404 && fallbackByUserIdStatus !== 401 && fallbackByUserIdStatus !== 403) {
                throw fallbackByUserIdError
              }
            }
          }

          try {
            const listings = await fetchRemoteWithToken<UserListingCard[]>(
              resolveUrl(buildLegacyMyListingsUrl()),
              token,
            )
            return filterDeletedListings(normalizeListingCardsMedia(listings), options?.includeDeleted)
          } catch (legacyError) {
            const legacyStatus = readHttpStatus(legacyError)
            if (legacyStatus !== 404) throw legacyError
          }
        }
        throw error
      }
    },
    resolveListingIdByHostname: async (hostname: string, listingSlug?: string | null): Promise<string | null> => {
      if (!apiEnabled || !hostname.trim()) return null

      try {
        const result = await fetchRemote<ListingHostnameResolution>(
          resolveUrl(buildResolveListingHostnameUrl(hostname, listingSlug)),
        )
        return readResolvedListingId(result)
      } catch (error) {
        if (readHttpStatus(error) === 404) return null
        throw error
      }
    },
    resolveListingIdBySlug,
    fetchListingBundle: async (listingId: string): Promise<RawListingBundle> => {
      console.log('[Domain][api] fetchListingBundle', { listingId })
      assertApiEnabled('charger une annonce')

      const bundle = await fetchRemote<RawListingBundle>(resolveUrl(buildListingBundleUrl(listingId)))
      const fallback = fallbackEditableBundle(listingId)
      return {
        core: bundle.core ?? { id: listingId },
        bookings: bundle.bookings ?? { price: 0, fees: [], 'booked-days': [], reservations: [] },
        medias: bundle.medias ?? { images: [], videos: [] },
        arrival: bundle.arrival ?? fallback.arrival ?? null,
        notes: bundle.notes ?? null,
        comments: bundle.comments ?? null,
        host: bundle.host ?? getCanonicalHost(),
      }
    },
    fetchEditableListingBundle: async (listingId: string): Promise<RawListingBundle> => {
      console.log('[Domain][api] fetchEditableListingBundle', { listingId })
      assertApiEnabled('charger le brouillon de cette annonce')

      const [core, bookings, medias, arrival] = await Promise.all([
        fetchRemote<RawCore>(resolveUrl(buildListingUrl('core', listingId))),
        fetchRemote<RawBookings>(resolveUrl(buildListingUrl('bookings', listingId))),
        fetchRemote<RawMedias>(resolveUrl(buildListingUrl('medias', listingId))),
        fetchRemote<RawArrival>(resolveUrl(buildListingUrl('arrival', listingId))),
      ])

      return { core, bookings, medias, arrival }
    },
    fetchVolatileListingBundle: async (listingId: string): Promise<VolatileBundle> => {
      console.log('[Domain][api] fetchVolatileListingBundle', { listingId })
      assertApiEnabled('charger les donnees de reservation')

      const [bookings, notes, comments, host] = await Promise.all([
        fetchRemote<RawBookings>(resolveUrl(buildListingUrl('bookings', listingId))),
        fetchRemote<RawNotes>(resolveUrl(buildListingUrl('notes', listingId))),
        fetchRemote<RawComments>(resolveUrl(buildListingUrl('comments', listingId))),
        fetchRemote<RawHost>(resolveUrl(buildListingUrl('host', listingId))),
      ])

      return { bookings, notes, comments, host: host ?? getCanonicalHost() }
    },
    syncListingAvailability: async (listingId: string): Promise<ListingAvailabilitySyncResult> => {
      console.log('[Domain][api] syncListingAvailability', { listingId })
      assertApiEnabled('synchroniser les disponibilites')

      return postRemotePublic<ListingAvailabilitySyncResult>(
        resolveUrl(buildListingAvailabilityRefreshUrl(listingId)),
        {},
      )
    },
    patchListingDraft: async (listingId: string, patch: DraftPatch): Promise<void> => {
      console.log('[Domain][api] patchListingDraft', { listingId, patch })
      assertApiEnabled('mettre a jour le brouillon')
      const token = await getAuthToken({ waitForReady: true })

      const requests: Promise<unknown>[] = []

      if (patch.core) {
        requests.push(patchRemoteWithToken(resolveUrl(buildListingUrl('core', listingId)), patch.core, token))
      }

      if (patch.bookings) {
        requests.push(patchRemoteWithToken(resolveUrl(buildListingUrl('bookings', listingId)), patch.bookings, token))
      }

      if (patch.medias) {
        requests.push(patchRemoteWithToken(resolveUrl(buildListingUrl('medias', listingId)), patch.medias, token))
      }

      if (patch.arrival) {
        requests.push(patchRemoteWithToken(resolveUrl(buildListingUrl('arrival', listingId)), patch.arrival, token))
      }

      if (patch.notes) {
        requests.push(patchRemoteWithToken(resolveUrl(buildListingUrl('notes', listingId)), patch.notes, token))
      }

      if (patch.comments) {
        requests.push(patchRemoteWithToken(resolveUrl(buildListingUrl('comments', listingId)), patch.comments, token))
      }

      if (requests.length) {
        await Promise.all(requests)
      }
    },
    publishListingDraft: async (listingId: string, draft: RawListingBundle): Promise<void> => {
      console.log('[Domain][api] publishListingDraft', { listingId, draft })
      assertApiEnabled('publier cette annonce')
      const token = await getAuthToken({ waitForReady: true })
      const medias = await ensurePublishedMediasStoredInImageKit(draft.medias, {
        listingId,
        listingStatus: typeof draft.core?.status === 'string' ? draft.core.status : null,
      })

      const requests: Promise<unknown>[] = []

      if (draft.core) {
        requests.push(patchRemoteWithToken(resolveUrl(buildListingUrl('core', listingId)), draft.core, token))
      }

      if (draft.bookings) {
        requests.push(patchRemoteWithToken(resolveUrl(buildListingUrl('bookings', listingId)), draft.bookings, token))
      }

      if (medias) {
        requests.push(patchRemoteWithToken(resolveUrl(buildListingUrl('medias', listingId)), medias, token))
      }

      if (draft.arrival) {
        requests.push(patchRemoteWithToken(resolveUrl(buildListingUrl('arrival', listingId)), draft.arrival, token))
      }

      if (draft.notes) {
        requests.push(patchRemoteWithToken(resolveUrl(buildListingUrl('notes', listingId)), draft.notes, token))
      }

      if (requests.length) {
        await Promise.all(requests)
      }
    },
    createListing: async (payload?: Partial<RawListingBundle>): Promise<{ listingId: string }> => {
      console.log('[Domain][api] createListing', { payload })
      assertApiEnabled('creer une annonce')

      const url = resolveUrl(buildCreateListingUrl())
      return postRemote<{ listingId: string }>(url, payload ?? {})
    },
  }
}
