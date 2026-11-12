// File: src/domain/api/listingHubs.ts

// Pages principales (annonces mères) : une page au domaine du propriétaire qui présente ses logements.

import { getFreshAuthToken } from '@/utils/authToken'
import { invalidateListing } from '@/domain/api/listingsCache'
import { sharedRequest } from '@/domain/api/requestCache'
import type { PageSection, PageThemeId, PlaceSetting, SiteFooter } from '@/domain/listings/pageThemes'

const PLACE_SETTINGS: readonly PlaceSetting[] = ['sea', 'inland']

function toPlaceSetting(value: unknown): PlaceSetting | null {
  return PLACE_SETTINGS.find((setting) => setting === value) ?? null
}

export type ListingHubSummary = {
  listingId: string
  title: string
  status: string
  hostname: string | null
  publicUrl: string | null
}

export type ListingHubChildCard = {
  listingId: string
  slug: string
  title: string
  status: string
  city: string | null
  region: string | null
  coverSrc: string | null
  pricePerNight: number | null
  guestCapacity: number | null
  roomsCount: number | null
  publicPath: string
  /** Près de la mer ou dans les terres, calculé par l'API d'après l'adresse du logement. */
  setting: PlaceSetting | null
}

export type ListingParentRecord = {
  listingId: string
  parentListingId: string | null
  parent: ListingHubSummary | null
}

const RAW_BASE_API_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim()
const BASE_API_URL = RAW_BASE_API_URL.replace(/\/$/, '')
const API_REQUEST_TIMEOUT_MS = (() => {
  const parsed = Number(import.meta.env.VITE_API_REQUEST_TIMEOUT_MS)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 20000
})()

function buildUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = `${BASE_API_URL}${normalizedPath}`
  if (typeof window === 'undefined') return url
  return new URL(url, window.location.origin).toString()
}

async function getAxios() {
  const { default: axios } = await import('axios')
  return axios
}

function readSessionToken(): Promise<string | null> {
  return getFreshAuthToken()
}

async function buildAuthHeaders(): Promise<{ Authorization: string }> {
  const token = await readSessionToken()
  if (!token) throw new Error('Session utilisateur absente. Veuillez vous reconnecter.')
  return { Authorization: `Bearer ${token}` }
}

function toApiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const responseMessage = (error as { response?: { data?: { message?: unknown } } }).response?.data?.message
    if (typeof responseMessage === 'string' && responseMessage.trim()) return responseMessage.trim()
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message.trim()
  }
  return fallback
}

function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toNullableNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function normalizeHubSummary(data: Record<string, unknown> | null | undefined): ListingHubSummary {
  const payload = data ?? {}
  return {
    listingId: toTrimmedString(payload.listingId),
    title: toTrimmedString(payload.title) || 'Page principale',
    status: toTrimmedString(payload.status) || 'draft',
    hostname: toTrimmedString(payload.hostname) || null,
    publicUrl: toTrimmedString(payload.publicUrl) || null,
  }
}

function normalizeChildCard(data: Record<string, unknown> | null | undefined): ListingHubChildCard {
  const payload = data ?? {}
  const slug = toTrimmedString(payload.slug)
  return {
    listingId: toTrimmedString(payload.listingId),
    slug,
    title: toTrimmedString(payload.title) || 'Logement',
    status: toTrimmedString(payload.status) || 'draft',
    city: toTrimmedString(payload.city) || null,
    region: toTrimmedString(payload.region) || null,
    coverSrc: toTrimmedString(payload.coverSrc) || null,
    pricePerNight: toNullableNumber(payload.pricePerNight),
    guestCapacity: toNullableNumber(payload.guestCapacity),
    roomsCount: toNullableNumber(payload.roomsCount),
    publicPath: toTrimmedString(payload.publicPath) || (slug ? `/${slug}` : '/'),
    setting: toPlaceSetting(payload.setting),
  }
}

function normalizeParentRecord(data: Record<string, unknown> | null | undefined): ListingParentRecord {
  const payload = data ?? {}
  const parent = payload.parent && typeof payload.parent === 'object' ? normalizeHubSummary(payload.parent as Record<string, unknown>) : null
  return {
    listingId: toTrimmedString(payload.listingId),
    parentListingId: toTrimmedString(payload.parentListingId) || null,
    parent,
  }
}

/** Pages principales du propriétaire (ou d'un client donné, pour l'admin). */
export async function fetchOwnedHubs(options?: { ownerId?: string | null }): Promise<ListingHubSummary[]> {
  const axios = await getAxios()
  const headers = await buildAuthHeaders()
  try {
    const { data } = await axios.get<{ hubs?: Array<Record<string, unknown>> }>(buildUrl('/listings/hubs'), {
      withCredentials: false,
      timeout: API_REQUEST_TIMEOUT_MS,
      headers,
      params: options?.ownerId ? { ownerId: options.ownerId } : undefined,
    })
    return (Array.isArray(data?.hubs) ? data.hubs : []).map((hub) => normalizeHubSummary(hub)).filter((hub) => Boolean(hub.listingId))
  } catch (error) {
    throw new Error(toApiErrorMessage(error, 'Impossible de charger les pages principales.'))
  }
}

export async function fetchListingParent(listingId: string): Promise<ListingParentRecord> {
  const axios = await getAxios()
  const headers = await buildAuthHeaders()
  try {
    const { data } = await axios.get<Record<string, unknown>>(buildUrl(`/listings/${encodeURIComponent(listingId.trim())}/parent`), {
      withCredentials: false,
      timeout: API_REQUEST_TIMEOUT_MS,
      headers,
    })
    return normalizeParentRecord(data)
  } catch (error) {
    throw new Error(toApiErrorMessage(error, 'Impossible de charger la page principale de cette annonce.'))
  }
}

/** Rattache l'annonce à une page principale (`null` pour la détacher). */
export async function setListingParent(listingId: string, parentListingId: string | null): Promise<ListingParentRecord> {
  const axios = await getAxios()
  const headers = await buildAuthHeaders()
  try {
    const { data } = await axios.put<Record<string, unknown>>(
      buildUrl(`/listings/${encodeURIComponent(listingId.trim())}/parent`),
      { parentListingId: parentListingId?.trim() || null },
      {
        withCredentials: false,
        timeout: API_REQUEST_TIMEOUT_MS,
        headers,
      },
    )
    // Le rattachement figure dans les données de l'annonce et de la page principale.
    invalidateListing(listingId)
    if (parentListingId?.trim()) invalidateListing(parentListingId)
    return normalizeParentRecord(data)
  } catch (error) {
    throw new Error(toApiErrorMessage(error, 'Impossible de modifier la page principale de cette annonce.'))
  }
}

export type ListingHubPublicPage = {
  /** Logements en ligne, affichés sur la page. */
  children: ListingHubChildCard[]
  /** Lieu (mer ou terres) de tous les logements rattachés, en pause compris : sert au thème d'office. */
  placeSettings: PlaceSetting[]
}

/** Logements en ligne d'une page principale et lieu de ses logements (page publique, sans authentification). */
export async function fetchHubPublicPage(hubId: string): Promise<ListingHubPublicPage> {
  const axios = await getAxios()
  try {
    const { data } = await axios.get<{ children?: Array<Record<string, unknown>>; placeSettings?: unknown[] }>(buildUrl(`/listings/${encodeURIComponent(hubId.trim())}/children`), {
      withCredentials: false,
      timeout: API_REQUEST_TIMEOUT_MS,
    })
    return {
      children: (Array.isArray(data?.children) ? data.children : []).map((child) => normalizeChildCard(child)),
      placeSettings: (Array.isArray(data?.placeSettings) ? data.placeSettings : [])
        .map((setting) => toPlaceSetting(setting))
        .filter((setting): setting is PlaceSetting => setting !== null),
    }
  } catch (error) {
    throw new Error(toApiErrorMessage(error, 'Impossible de charger les logements.'))
  }
}

/** Tous les logements rattachés (éditeur), y compris en brouillon. */
export async function fetchHubChildrenForOwner(hubId: string): Promise<ListingHubChildCard[]> {
  const axios = await getAxios()
  const headers = await buildAuthHeaders()
  try {
    const { data } = await axios.get<{ children?: Array<Record<string, unknown>> }>(buildUrl(`/listings/${encodeURIComponent(hubId.trim())}/children/manage`), {
      withCredentials: false,
      timeout: API_REQUEST_TIMEOUT_MS,
      headers,
    })
    return (Array.isArray(data?.children) ? data.children : []).map((child) => normalizeChildCard(child))
  } catch (error) {
    throw new Error(toApiErrorMessage(error, 'Impossible de charger les logements rattachés.'))
  }
}

// --- Page de présentation (mode édition sur la page) ----------------------------------------

export type HubPageSave = {
  /** Titre de la page. Absent : inchangé. */
  title?: string
  /** Nouvelle photo d'en-tête (adresse ImageKit). Absent : inchangée. */
  coverSrc?: string
  page: {
    /** `null` : thème d'office selon le lieu des logements. */
    theme: PageThemeId | null
    tagline: string
    location: string
    sections: PageSection[]
    footer: SiteFooter
  }
}

// Site et API se déploient séparément : tant que l'API n'a pas reçu la mise à jour, la route de la
// page n'existe pas chez elle et la requête tombe sur une autre route (400 « Invalid request
// payload ») ou sur aucune (404 « Route … not found »). On le dit en clair plutôt que d'afficher ce message.
function isHubPageRouteMissing(error: unknown): boolean {
  const response = (error as { response?: { status?: unknown; data?: unknown } } | null)?.response
  const data = (response?.data ?? {}) as { message?: unknown; issues?: unknown; error?: unknown }
  if (response?.status === 400 && Array.isArray(data.issues)) {
    return data.issues.some((issue) => (issue as { path?: unknown } | null)?.path === 'resource')
  }
  return response?.status === 404 && typeof data.message === 'string' && data.message.startsWith('Route ')
}

const HUB_PAGE_UNAVAILABLE = 'La modification de la page n’est pas encore disponible : le serveur n’a pas reçu la dernière mise à jour. Réessayez dans quelques minutes.'

function buildHubPageUrl(listingId: string): string {
  return buildUrl(`/listings/${encodeURIComponent(listingId.trim())}/page`)
}

/** Vérifie que le compte connecté peut modifier cette page (propriétaire ou admin, page principale). */
export async function assertCanEditHubPage(listingId: string): Promise<void> {
  const axios = await getAxios()
  const headers = await buildAuthHeaders()
  try {
    await axios.get(buildHubPageUrl(listingId), {
      withCredentials: false,
      timeout: API_REQUEST_TIMEOUT_MS,
      headers,
    })
  } catch (error) {
    if (isHubPageRouteMissing(error)) throw new Error(HUB_PAGE_UNAVAILABLE)
    throw new Error(toApiErrorMessage(error, 'Impossible d’ouvrir cette page en modification.'))
  }
}

/** Enregistre la page de présentation : elle est en ligne aussitôt, sans étape « Appliquer ». */
export async function saveHubPage(listingId: string, update: HubPageSave): Promise<void> {
  const axios = await getAxios()
  const headers = await buildAuthHeaders()
  try {
    await axios.put(buildHubPageUrl(listingId), update, {
      withCredentials: false,
      timeout: API_REQUEST_TIMEOUT_MS,
      headers,
    })
  } catch (error) {
    if (isHubPageRouteMissing(error)) throw new Error(HUB_PAGE_UNAVAILABLE)
    throw new Error(toApiErrorMessage(error, 'Enregistrement impossible. Vérifiez votre connexion.'))
  } finally {
    // Titre, photo d'en-tête et page figurent dans les sections `core` et `medias` de l'annonce.
    invalidateListing(listingId)
  }
}

// --- Site de l'hôte (pages des logements) -----------------------------------------------------

export type ListingSiteInfo = {
  /** Nom du site : celui de la page principale du logement, sinon le titre du logement. */
  siteName: string
  footer: SiteFooter
  hubListingId: string | null
}

function normalizeSiteFooter(data: unknown): SiteFooter {
  const payload = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  return {
    name: toTrimmedString(payload.name),
    text: toTrimmedString(payload.text),
    email: toTrimmedString(payload.email),
    phone: toTrimmedString(payload.phone),
  }
}

/** Nom du site et pied de page d'une annonce (page publique, sans authentification). */
export function fetchListingSite(listingId: string): Promise<ListingSiteInfo> {
  const id = listingId.trim()
  return sharedRequest(`listing-site:${id}`, async () => {
    const axios = await getAxios()
    const { data } = await axios.get<Record<string, unknown>>(buildUrl(`/listings/${encodeURIComponent(id)}/site`), {
      withCredentials: false,
      timeout: API_REQUEST_TIMEOUT_MS,
    })
    return {
      siteName: toTrimmedString(data?.siteName),
      footer: normalizeSiteFooter(data?.footer),
      hubListingId: toTrimmedString(data?.hubListingId) || null,
    }
  }, { ttlMs: 60_000 })
}
