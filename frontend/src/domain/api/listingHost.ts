// File: src/domain/api/listingHost.ts
// Section `host` d'une annonce : mentions légales du loueur (qualité particulier / professionnel,
// raison sociale, SIRET). Enregistrées directement, hors du brouillon local de l'éditeur : l'API
// fusionne le correctif avec la section existante puis réapplique l'identité Clerk (nom, avatar).

import clerkToken from '@/utils/clerkToken'
import { invalidateListingSections } from '@/domain/api/listingsCache'
import type { HostLegalStatus } from '@/domain/listings/types'

export type ListingHostLegalPatch = {
  legalStatus?: HostLegalStatus
  companyName?: string
  siret?: string
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

function toApiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const responseMessage = (error as { response?: { data?: { message?: unknown } } }).response?.data?.message
    if (typeof responseMessage === 'string' && responseMessage.trim()) return responseMessage.trim()
  }
  return fallback
}

/** Enregistre les mentions légales du loueur sur la section `host` de l'annonce (propriétaire ou admin). */
export async function saveListingHostLegalInfo(listingId: string, patch: ListingHostLegalPatch): Promise<void> {
  const token = await readSessionToken()
  if (!token) throw new Error('Session utilisateur absente. Veuillez vous reconnecter.')

  const { default: axios } = await import('axios')
  try {
    await axios.patch(buildUrl(`/listings/host/${encodeURIComponent(listingId)}`), patch, {
      withCredentials: false,
      timeout: API_REQUEST_TIMEOUT_MS,
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch (error) {
    throw new Error(toApiErrorMessage(error, 'Impossible d’enregistrer ces informations. Réessayez.'))
  } finally {
    invalidateListingSections(listingId)
  }
}
