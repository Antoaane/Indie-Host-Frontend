// File: src/domain/api/listingHubs.ts
// Pages principales (annonces mères) : une page au domaine du propriétaire qui présente ses logements.

import clerkToken from '@/utils/clerkToken'

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

async function readSessionToken(): Promise<string | null> {
  const stored = (clerkToken.value ?? '').trim()
  if (stored) return stored

  if (typeof window === 'undefined') return null
  const clerk = (window as Window & {
    Clerk?: { session?: { getToken?: () => Promise<string | null> } }
  }).Clerk
  try {
    const token = (await clerk?.session?.getToken?.())?.trim() ?? ''
    if (token) clerkToken.value = token
    return token || null
  } catch {
    return null
  }
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
    return normalizeParentRecord(data)
  } catch (error) {
    throw new Error(toApiErrorMessage(error, 'Impossible de modifier la page principale de cette annonce.'))
  }
}

/** Logements en ligne d'une page principale (page publique, sans authentification). */
export async function fetchHubChildrenPublic(hubId: string): Promise<ListingHubChildCard[]> {
  const axios = await getAxios()
  try {
    const { data } = await axios.get<{ children?: Array<Record<string, unknown>> }>(buildUrl(`/listings/${encodeURIComponent(hubId.trim())}/children`), {
      withCredentials: false,
      timeout: API_REQUEST_TIMEOUT_MS,
    })
    return (Array.isArray(data?.children) ? data.children : []).map((child) => normalizeChildCard(child))
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
