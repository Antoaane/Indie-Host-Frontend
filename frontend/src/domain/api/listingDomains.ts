// File: src/domain/api/listingDomains.ts

import clerkToken from '@/utils/clerkToken'

export type ListingSubdomainAvailability = {
  slug: string
  available: boolean
  hostname: string
  publicUrl: string
  reason: string | null
}

export type ListingCustomDomainStatus = 'none' | 'pending' | 'verified'

export type ListingCustomDomainTargets = {
  ipv4: string | null
  cname: string | null
}

export type ListingDomainRecord = {
  listingId: string
  subdomainSlug: string | null
  hostname: string | null
  publicUrl: string | null
  customDomain: string | null
  customDomainStatus: ListingCustomDomainStatus
  customDomainUrl: string | null
  customDomainVerifiedAt: string | null
  customDomainTargets: ListingCustomDomainTargets
}

export type ListingCustomDomainVerification = {
  ok: boolean
  resolvedAddresses: string[]
  reason: string | null
}

export type ListingCustomDomainVerificationResult = {
  record: ListingDomainRecord
  verification: ListingCustomDomainVerification
}

const RAW_BASE_API_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim()
const BASE_API_URL = normalizeApiBaseUrl(RAW_BASE_API_URL)
const API_REQUEST_TIMEOUT_MS = resolveRequestTimeoutMs(import.meta.env.VITE_API_REQUEST_TIMEOUT_MS, 20000)
const AUTH_TOKEN_MIN_VALIDITY_MS = 60_000

type AuthHeaders = {
  Authorization: string
}

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

function joinUrl(base: string, path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const normalizedBase = base.replace(/\/+$/, '')
  if (!normalizedBase) return normalizedPath
  return `${normalizedBase}${normalizedPath}`
}

function resolveUrl(url: string) {
  if (typeof window === 'undefined') return url
  return new URL(url, window.location.origin).toString()
}

async function getAxios() {
  const { default: axios } = await import('axios')
  return axios
}

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

  return exp * 1000 - Date.now() > minValidityMs
}

function readStoredToken(): string | null {
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
  const stored = readStoredToken()
  if (stored) return stored

  const fresh = await readFreshTokenFromClerkRuntime()
  if (fresh) return fresh

  if (!options?.waitForReady) return null

  const waited = await waitForClerkToken({ timeoutMs: 2000, pollEveryMs: 50 })
  if (!waited) return null
  if (!hasValidLifetime(waited)) {
    clerkToken.value = null
    return readFreshTokenFromClerkRuntime({ skipCache: true })
  }
  return waited
}

function buildAuthHeaders(token: string | null): AuthHeaders | undefined {
  return token ? { Authorization: `Bearer ${token}` } : undefined
}

function readHttpStatus(error: unknown): number | null {
  const status = (error as { response?: { status?: unknown } })?.response?.status
  if (typeof status === 'number' && Number.isFinite(status)) return status
  return null
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

async function requestWithAuth<T>(
  request: (headers: AuthHeaders | undefined) => Promise<{ data: T }>,
  options: {
    fallbackErrorMessage: string
    requiresAuth?: boolean
  },
): Promise<T> {
  const initialToken = await getAuthToken({ waitForReady: true })

  if (options.requiresAuth && !initialToken) {
    throw new Error('Session utilisateur absente. Veuillez vous reconnecter.')
  }

  try {
    const { data } = await request(buildAuthHeaders(initialToken))
    return data
  } catch (error) {
    if (readHttpStatus(error) === 401) {
      const refreshedToken = await readFreshTokenFromClerkRuntime({ skipCache: true })
      if (refreshedToken) {
        const { data } = await request(buildAuthHeaders(refreshedToken))
        return data
      }
    }

    throw new Error(toApiErrorMessage(error, options.fallbackErrorMessage))
  }
}

function buildAvailabilityUrl(slug: string, excludeListingId?: string) {
  const params = new URLSearchParams({ slug: slug.trim().toLowerCase() })
  if (excludeListingId?.trim()) params.set('excludeListingId', excludeListingId.trim())
  return joinUrl(BASE_API_URL, `/listings/domains/availability?${params.toString()}`)
}

function buildListingDomainUrl(listingId: string) {
  return joinUrl(BASE_API_URL, `/listings/${listingId.trim()}/domain`)
}

function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function buildListingCustomDomainUrl(listingId: string, suffix = '') {
  return joinUrl(BASE_API_URL, `/listings/${listingId.trim()}/custom-domain${suffix}`)
}

function normalizeCustomDomainStatus(value: unknown): ListingCustomDomainStatus {
  const status = toTrimmedString(value)
  return status === 'verified' || status === 'pending' ? status : 'none'
}

function normalizeDomainRecord(data: Record<string, unknown> | null | undefined): ListingDomainRecord {
  const payload = data ?? {}
  const targets = (payload.customDomainTargets && typeof payload.customDomainTargets === 'object'
    ? payload.customDomainTargets
    : {}) as Record<string, unknown>

  return {
    listingId: toTrimmedString(payload.listingId),
    subdomainSlug: toTrimmedString(payload.subdomainSlug) || null,
    hostname: toTrimmedString(payload.hostname) || null,
    publicUrl: toTrimmedString(payload.publicUrl) || null,
    customDomain: toTrimmedString(payload.customDomain) || null,
    customDomainStatus: normalizeCustomDomainStatus(payload.customDomainStatus),
    customDomainUrl: toTrimmedString(payload.customDomainUrl) || null,
    customDomainVerifiedAt: toTrimmedString(payload.customDomainVerifiedAt) || null,
    customDomainTargets: {
      ipv4: toTrimmedString(targets.ipv4) || null,
      cname: toTrimmedString(targets.cname) || null,
    },
  }
}

function normalizeVerification(data: Record<string, unknown> | null | undefined): ListingCustomDomainVerification {
  const payload = data ?? {}
  const addresses = Array.isArray(payload.resolvedAddresses) ? payload.resolvedAddresses : []

  return {
    ok: Boolean(payload.ok),
    resolvedAddresses: addresses.map((value) => toTrimmedString(value)).filter(Boolean),
    reason: toTrimmedString(payload.reason) || null,
  }
}

function normalizeAvailability(data: Record<string, unknown> | null | undefined): ListingSubdomainAvailability {
  const payload = data ?? {}

  return {
    slug: toTrimmedString(payload.slug),
    available: Boolean(payload.available),
    hostname: toTrimmedString(payload.hostname),
    publicUrl: toTrimmedString(payload.publicUrl),
    reason: toTrimmedString(payload.reason) || null,
  }
}

export async function fetchListingSubdomainAvailability(slug: string, excludeListingId?: string): Promise<ListingSubdomainAvailability> {
  const axios = await getAxios()
  const url = resolveUrl(buildAvailabilityUrl(slug, excludeListingId))
  const data = await requestWithAuth<Record<string, unknown>>((headers) => axios.get(url, {
    withCredentials: false,
    timeout: API_REQUEST_TIMEOUT_MS,
    headers,
  }), {
    fallbackErrorMessage: 'Impossible de vérifier la disponibilité du sous-domaine.',
    requiresAuth: true,
  })
  return normalizeAvailability(data)
}

export async function fetchListingDomain(listingId: string): Promise<ListingDomainRecord> {
  const axios = await getAxios()
  const url = resolveUrl(buildListingDomainUrl(listingId))
  const data = await requestWithAuth<Record<string, unknown>>((headers) => axios.get(url, {
    withCredentials: false,
    timeout: API_REQUEST_TIMEOUT_MS,
    headers,
  }), {
    fallbackErrorMessage: 'Impossible de charger le sous-domaine actuel.',
    requiresAuth: true,
  })
  return normalizeDomainRecord(data)
}

export async function saveListingDomain(listingId: string, slug: string): Promise<ListingDomainRecord> {
  const axios = await getAxios()
  const url = resolveUrl(buildListingDomainUrl(listingId))
  const data = await requestWithAuth<Record<string, unknown>>((headers) => axios.put(url, { slug: slug.trim().toLowerCase() }, {
    withCredentials: false,
    timeout: API_REQUEST_TIMEOUT_MS,
    headers,
  }), {
    fallbackErrorMessage: 'Impossible d’enregistrer ce sous-domaine.',
    requiresAuth: true,
  })
  return normalizeDomainRecord(data)
}

export async function removeListingDomain(listingId: string): Promise<ListingDomainRecord> {
  const axios = await getAxios()
  const url = resolveUrl(buildListingDomainUrl(listingId))
  const data = await requestWithAuth<Record<string, unknown>>((headers) => axios.delete(url, {
    withCredentials: false,
    timeout: API_REQUEST_TIMEOUT_MS,
    headers,
  }), {
    fallbackErrorMessage: 'Impossible de libérer ce sous-domaine.',
    requiresAuth: true,
  })
  return normalizeDomainRecord(data)
}

export async function saveListingCustomDomain(listingId: string, domain: string): Promise<ListingDomainRecord> {
  const axios = await getAxios()
  const url = resolveUrl(buildListingCustomDomainUrl(listingId))
  const data = await requestWithAuth<Record<string, unknown>>((headers) => axios.put(url, { domain: domain.trim().toLowerCase() }, {
    withCredentials: false,
    timeout: API_REQUEST_TIMEOUT_MS,
    headers,
  }), {
    fallbackErrorMessage: 'Impossible de rattacher ce nom de domaine.',
    requiresAuth: true,
  })
  return normalizeDomainRecord(data)
}

export async function verifyListingCustomDomain(listingId: string): Promise<ListingCustomDomainVerificationResult> {
  const axios = await getAxios()
  const url = resolveUrl(buildListingCustomDomainUrl(listingId, '/verify'))
  const data = await requestWithAuth<Record<string, unknown>>((headers) => axios.post(url, null, {
    withCredentials: false,
    timeout: API_REQUEST_TIMEOUT_MS,
    headers,
  }), {
    fallbackErrorMessage: 'Impossible de vérifier la configuration DNS.',
    requiresAuth: true,
  })
  const payload = data ?? {}
  return {
    record: normalizeDomainRecord(payload.record as Record<string, unknown> | undefined),
    verification: normalizeVerification(payload.verification as Record<string, unknown> | undefined),
  }
}

export async function removeListingCustomDomain(listingId: string): Promise<ListingDomainRecord> {
  const axios = await getAxios()
  const url = resolveUrl(buildListingCustomDomainUrl(listingId))
  const data = await requestWithAuth<Record<string, unknown>>((headers) => axios.delete(url, {
    withCredentials: false,
    timeout: API_REQUEST_TIMEOUT_MS,
    headers,
  }), {
    fallbackErrorMessage: 'Impossible de détacher ce nom de domaine.',
    requiresAuth: true,
  })
  return normalizeDomainRecord(data)
}
