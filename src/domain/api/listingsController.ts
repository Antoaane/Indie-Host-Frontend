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
  RawArrival,
  RawMedias,
  RawNotes,
  UserListingCard,
  VolatileBundle,
} from '@/domain/listings/types'
import type { FetchListingsOptions, ListingsController } from '@/domain/listings/controller'
import { filterDeletedListings } from '@/domain/listings/status'

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
        title: 'Découvertes locales',
        content:
          '<h3>Patrimoine &amp; culture</h3>\\n<ul>\\n  <li><strong>Église Saint-Saturnin</strong> — édifice roman classé, à quelques minutes.</li>\\n  <li><strong>Château de Langoiran</strong> — vue panoramique sur la vallée.</li>\\n</ul>\\n<h3>Vignobles &amp; dégustations</h3>\\n<ul>\\n  <li><strong>Château Haut Peyrat</strong> — visites guidées et dégustations.</li>\\n  <li><strong>Domaine de Saint-Amand</strong> — vins bio et ateliers œnologiques.</li>\\n</ul>\\n<h3>Balades &amp; nature</h3>\\n<ul>\\n  <li><strong>Piste Roger Lapébie</strong> — ancienne voie ferrée aménagée.</li>\\n  <li><strong>Bord du lac</strong> — promenade calme au coucher du soleil.</li>\\n</ul>\\n<h3>Activités nautiques</h3>\\n<ul>\\n  <li><strong>Base nautique</strong> — paddle, canoë et bouées tractées.</li>\\n</ul>',
      },
    },
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
      const listings = await fetchRemote<UserListingCard[]>(url)
      return filterDeletedListings(listings, options?.includeDeleted)
    },
    fetchListingBundle: async (listingId: string): Promise<RawListingBundle> => {
      console.log('[Domain][api] fetchListingBundle', { listingId })
      if (!apiEnabled) return fallbackEditableBundle(listingId)

      const [core, bookings, medias, arrival, notes, comments, host] = await Promise.all([
        fetchRemote<RawCore>(resolveUrl(buildListingUrl('core', listingId))),
        fetchRemote<RawBookings>(resolveUrl(buildListingUrl('bookings', listingId))),
        fetchRemote<RawMedias>(resolveUrl(buildListingUrl('medias', listingId))),
        fetchRemote<RawArrival>(resolveUrl(buildListingUrl('arrival', listingId))),
        fetchRemote<RawNotes>(resolveUrl(buildListingUrl('notes', listingId))),
        fetchRemote<RawComments>(resolveUrl(buildListingUrl('comments', listingId))),
        fetchRemote<RawHost>(resolveUrl(buildListingUrl('host', listingId))),
      ])

      return { core, bookings, medias, arrival, notes, comments, host }
    },
    fetchEditableListingBundle: async (listingId: string): Promise<RawListingBundle> => {
      console.log('[Domain][api] fetchEditableListingBundle', { listingId })
      if (!apiEnabled) return fallbackEditableBundle(listingId)

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

      if (patch.arrival) {
        requests.push(patchRemote(resolveUrl(buildListingUrl('arrival', listingId)), patch.arrival))
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

      if (draft.arrival) {
        requests.push(patchRemote(resolveUrl(buildListingUrl('arrival', listingId)), draft.arrival))
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
