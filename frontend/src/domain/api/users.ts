// File: src/domain/api/users.ts

import clerkToken from '@/utils/clerkToken'

export type ApiUserRecord = {
  id: string
  email: string | null
  firstName: string | null
  lastName: string | null
  displayName: string | null
  avatarUrl: string | null
  hostProfile: Record<string, unknown>
  isAdmin: boolean
  authRole: string | null
}

export type UpdateMyUserPayload = {
  email?: string
  firstName?: string
  lastName?: string
  displayName?: string
  avatarUrl?: string
  hostProfile?: Record<string, unknown>
}

export type AdminPlatformUser = {
  id: string
  email: string | null
  firstName: string | null
  lastName: string | null
  displayName: string | null
  username: string | null
  avatarUrl: string | null
}

export type TransferListingOwnershipPayload = {
  targetUserId: string
  trialDays?: number
}

export type TransferListingOwnershipResponse = {
  listingId: string
  previousOwnerId: string | null
  ownerId: string
  transferredAtISO: string
  trial: {
    applied: boolean
    days: number
    startsAtISO: string | null
    endsAtISO: string | null
  }
}

const RAW_BASE_API_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim()
const BASE_API_URL = normalizeApiBaseUrl(RAW_BASE_API_URL)

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

function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function normalizeOptionalText(value: unknown): string | null {
  const normalized = toTrimmedString(value)
  return normalized || null
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

function hasValidLifetime(token: string, minValidityMs = 10_000): boolean {
  if (typeof window === 'undefined' || typeof window.atob !== 'function') return true

  const payload = readJwtPayload(token)
  if (!payload) return true

  const exp = payload.exp
  if (typeof exp !== 'number' || !Number.isFinite(exp)) return true

  const remainingMs = exp * 1000 - Date.now()
  return remainingMs > minValidityMs
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

async function readFreshTokenFromClerkRuntime(): Promise<string | null> {
  if (typeof window === 'undefined') return null

  const clerk = (window as Window & {
    Clerk?: {
      session?: {
        getToken?: () => Promise<string | null>
      }
    }
  }).Clerk

  const getSessionToken = clerk?.session?.getToken
  if (typeof getSessionToken !== 'function') return null

  try {
    const token = (await getSessionToken())?.trim() ?? ''
    if (!token || !hasValidLifetime(token)) return null
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
    return readFreshTokenFromClerkRuntime()
  }
  return waited
}

function readHttpStatus(error: unknown): number | null {
  const status = (error as { response?: { status?: unknown } })?.response?.status
  if (typeof status === 'number' && Number.isFinite(status)) return status
  return null
}

function normalizeUserRecord(data: Record<string, unknown> | null | undefined): ApiUserRecord {
  const payload = data ?? {}

  return {
    id: toTrimmedString(payload.id),
    email: normalizeOptionalText(payload.email),
    firstName: normalizeOptionalText(payload.firstName),
    lastName: normalizeOptionalText(payload.lastName),
    displayName: normalizeOptionalText(payload.displayName),
    avatarUrl: normalizeOptionalText(payload.avatarUrl),
    hostProfile: asRecord(payload.hostProfile),
    isAdmin: Boolean(payload.isAdmin),
    authRole: normalizeOptionalText(payload.authRole),
  }
}

function buildAuthHeaders(token: string | null) {
  return token ? { Authorization: `Bearer ${token}` } : undefined
}

async function buildRequiredAuthHeaders() {
  const token = await getAuthToken({ waitForReady: true })
  const headers = buildAuthHeaders(token)
  if (!headers || !token) {
    throw new Error('Session utilisateur absente. Veuillez vous reconnecter.')
  }
  return headers
}

function buildMyUserUrl() {
  return joinUrl(BASE_API_URL, '/users/me')
}

function buildAdminUsersSearchUrl() {
  return joinUrl(BASE_API_URL, '/users/admin/search')
}

function buildAdminListingTransferUrl(listingId: string) {
  return joinUrl(BASE_API_URL, `/listings/admin/${encodeURIComponent(listingId.trim())}/transfer`)
}

function toApiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const response = (error as { response?: { data?: { message?: unknown } } }).response
    const responseMessage = response?.data?.message
    if (typeof responseMessage === 'string' && responseMessage.trim()) return responseMessage.trim()

    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message.trim()
  }

  return fallback
}

export async function fetchMyUser(): Promise<ApiUserRecord> {
  const axios = await getAxios()
  const url = resolveUrl(buildMyUserUrl())
  const initialToken = await getAuthToken({ waitForReady: true })

  try {
    const { data } = await axios.get<Record<string, unknown>>(url, {
      withCredentials: false,
      headers: buildAuthHeaders(initialToken),
    })
    return normalizeUserRecord(data)
  } catch (error) {
    if (readHttpStatus(error) === 401) {
      const refreshedToken = await readFreshTokenFromClerkRuntime()
      if (refreshedToken && refreshedToken !== initialToken) {
        const { data } = await axios.get<Record<string, unknown>>(url, {
          withCredentials: false,
          headers: buildAuthHeaders(refreshedToken),
        })
        return normalizeUserRecord(data)
      }
    }

    throw error
  }
}

export async function updateMyUser(payload: UpdateMyUserPayload): Promise<ApiUserRecord> {
  const axios = await getAxios()
  const url = resolveUrl(buildMyUserUrl())
  const initialToken = await getAuthToken({ waitForReady: true })

  try {
    const { data } = await axios.patch<Record<string, unknown>>(url, payload, {
      withCredentials: false,
      headers: buildAuthHeaders(initialToken),
    })
    return normalizeUserRecord(data)
  } catch (error) {
    if (readHttpStatus(error) === 401) {
      const refreshedToken = await readFreshTokenFromClerkRuntime()
      if (refreshedToken && refreshedToken !== initialToken) {
        const { data } = await axios.patch<Record<string, unknown>>(url, payload, {
          withCredentials: false,
          headers: buildAuthHeaders(refreshedToken),
        })
        return normalizeUserRecord(data)
      }
    }

    throw error
  }
}

function normalizeAdminPlatformUser(data: Record<string, unknown> | null | undefined): AdminPlatformUser {
  const payload = data ?? {}

  return {
    id: toTrimmedString(payload.id),
    email: normalizeOptionalText(payload.email),
    firstName: normalizeOptionalText(payload.firstName),
    lastName: normalizeOptionalText(payload.lastName),
    displayName: normalizeOptionalText(payload.displayName),
    username: normalizeOptionalText(payload.username),
    avatarUrl: normalizeOptionalText(payload.avatarUrl),
  }
}

export async function searchAdminPlatformUsers(input?: {
  query?: string
  limit?: number
}): Promise<AdminPlatformUser[]> {
  const axios = await getAxios()
  const url = resolveUrl(buildAdminUsersSearchUrl())
  const headers = await buildRequiredAuthHeaders()

  try {
    const { data } = await axios.get<{ users?: Array<Record<string, unknown>> }>(url, {
      withCredentials: false,
      headers,
      params: {
        query: toTrimmedString(input?.query),
        limit: input?.limit ?? 2000,
      },
    })

    const users = Array.isArray(data?.users) ? data.users : []
    return users
      .map((user) => normalizeAdminPlatformUser(user))
      .filter((user) => Boolean(user.id))
  } catch (error) {
    throw new Error(toApiErrorMessage(error, 'Impossible de charger la liste des utilisateurs.'))
  }
}

export async function transferListingOwnershipAsAdmin(
  listingId: string,
  payload: TransferListingOwnershipPayload,
): Promise<TransferListingOwnershipResponse> {
  const normalizedListingId = listingId.trim()
  if (!normalizedListingId) {
    throw new Error('Annonce invalide pour le transfert.')
  }

  const normalizedTargetUserId = payload.targetUserId.trim()
  if (!normalizedTargetUserId) {
    throw new Error('Utilisateur cible manquant.')
  }

  const axios = await getAxios()
  const url = resolveUrl(buildAdminListingTransferUrl(normalizedListingId))
  const headers = await buildRequiredAuthHeaders()

  try {
    const { data } = await axios.post<TransferListingOwnershipResponse>(
      url,
      {
        targetUserId: normalizedTargetUserId,
        trialDays: Number.isFinite(Number(payload.trialDays)) ? Math.max(0, Math.trunc(Number(payload.trialDays))) : 0,
      },
      {
        withCredentials: false,
        headers,
      },
    )

    return data
  } catch (error) {
    throw new Error(toApiErrorMessage(error, 'Impossible de transférer cette annonce.'))
  }
}
