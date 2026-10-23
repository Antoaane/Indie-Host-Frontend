// File: src/domain/api/privacy.ts
// Droits RGPD du compte : export des données et suppression du compte.

import clerkToken from '@/utils/clerkToken'

const RAW_BASE_API_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim()
const BASE_API_URL = RAW_BASE_API_URL.replace(/\/+$/, '')

export type AccountDeletionResponse = {
  deleted: boolean
  clerk: 'deleted' | 'skipped' | 'failed'
  warning: string | null
}

/** Refus de l'API (abonnement actif, séjour à venir, compte administrateur) : message à afficher tel quel. */
export class AccountDeletionRefusedError extends Error {
  readonly code: string | null
  readonly status: number

  constructor(message: string, status: number, code: string | null) {
    super(message)
    this.name = 'AccountDeletionRefusedError'
    this.status = status
    this.code = code
  }
}

function joinUrl(base: string, path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (!base) return normalizedPath
  return `${base}${normalizedPath}`
}

function resolveUrl(url: string) {
  if (typeof window === 'undefined') return url
  return new URL(url, window.location.origin).toString()
}

async function getAxios() {
  const { default: axios } = await import('axios')
  return axios
}

async function readFreshTokenFromClerkRuntime(): Promise<string | null> {
  if (typeof window === 'undefined') return null

  const clerk = (window as Window & {
    Clerk?: { session?: { getToken?: () => Promise<string | null> } }
  }).Clerk
  const getSessionToken = clerk?.session?.getToken
  if (typeof getSessionToken !== 'function') return null

  try {
    const token = (await getSessionToken())?.trim() ?? ''
    if (!token) return null
    clerkToken.value = token
    return token
  } catch {
    return null
  }
}

async function buildAuthHeaders(): Promise<{ Authorization: string }> {
  const stored = (clerkToken.value ?? '').trim()
  const token = stored || (await readFreshTokenFromClerkRuntime())
  if (!token) {
    throw new Error('Session utilisateur absente. Veuillez vous reconnecter.')
  }
  return { Authorization: `Bearer ${token}` }
}

function readHttpStatus(error: unknown): number | null {
  const status = (error as { response?: { status?: unknown } })?.response?.status
  return typeof status === 'number' && Number.isFinite(status) ? status : null
}

function readResponseField(error: unknown, field: string): string | null {
  const data = (error as { response?: { data?: Record<string, unknown> } })?.response?.data
  const value = data?.[field]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readFilename(contentDisposition: unknown, fallback: string): string {
  if (typeof contentDisposition !== 'string') return fallback
  const match = /filename="?([^";]+)"?/i.exec(contentDisposition)
  return match?.[1]?.trim() || fallback
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Laisse au navigateur le temps de démarrer le téléchargement avant de libérer l'URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Télécharge l'export JSON de toutes les données du compte (`GET /users/me/export`). */
export async function downloadMyDataExport(): Promise<void> {
  const axios = await getAxios()
  const headers = await buildAuthHeaders()
  const url = resolveUrl(joinUrl(BASE_API_URL, '/users/me/export'))

  try {
    const response = await axios.get<Blob>(url, {
      withCredentials: false,
      headers,
      responseType: 'blob',
    })

    const date = new Date().toISOString().slice(0, 10)
    const filename = readFilename(response.headers?.['content-disposition'], `indiehost-export-${date}.json`)
    triggerBlobDownload(response.data, filename)
  } catch (error) {
    const message = readResponseField(error, 'message')
    throw new Error(message ?? 'Le téléchargement de vos données a échoué. Réessayez dans quelques instants.')
  }
}

/** Supprime le compte (`DELETE /users/me`). Lève `AccountDeletionRefusedError` si l'API refuse (403 / 409). */
export async function deleteMyAccount(): Promise<AccountDeletionResponse> {
  const axios = await getAxios()
  const headers = await buildAuthHeaders()
  const url = resolveUrl(joinUrl(BASE_API_URL, '/users/me'))

  try {
    const { data } = await axios.delete<Record<string, unknown>>(url, {
      withCredentials: false,
      headers,
    })

    const clerk = data?.clerk
    return {
      deleted: data?.deleted === true,
      clerk: clerk === 'deleted' || clerk === 'skipped' || clerk === 'failed' ? clerk : 'deleted',
      warning: typeof data?.warning === 'string' && data.warning.trim() ? data.warning.trim() : null,
    }
  } catch (error) {
    const status = readHttpStatus(error)
    const message = readResponseField(error, 'message')
    if (status === 403 || status === 409) {
      throw new AccountDeletionRefusedError(
        message ?? 'La suppression du compte n’est pas possible pour le moment.',
        status,
        readResponseField(error, 'code'),
      )
    }
    throw new Error(message ?? 'La suppression du compte a échoué. Réessayez dans quelques instants.')
  }
}
