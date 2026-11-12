// File: src/domain/api/admin.ts

// Administration d'IndieHost (`/admin/*` de l'API) : chiffres, paiements, droits des comptes, santé
// des services en direct et carte du code. Types en miroir de backend/api/src/domains/admin/.

import { getFreshAuthToken } from '@/utils/authToken'

const RAW_BASE_API_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim()
const BASE_API_URL = RAW_BASE_API_URL.replace(/\/+$/, '')

// --- Types ---------------------------------------------------------------------------------

export type AdminTab = 'overview' | 'users' | 'payments' | 'services'

export type AdminAttentionItem = {
  id: string
  tone: 'bad' | 'warn'
  title: string
  detail: string
  target: { tab: Exclude<AdminTab, 'overview'>; userId?: string | null }
}

export type AdminOverview = {
  generatedAtISO: string
  subscribers: {
    source: 'stripe' | 'database'
    paying: number
    trialing: number
    complimentary: number
    pastDue: number
    canceledLast30Days: number
    byPlan: { indiehost: number; superhost: number }
    extraListings: number
    monthlyRevenueMinor: number | null
    currency: string
  }
  accounts: {
    total: number
    newLast30Days: number
    withPublishedListing: number
    clerkTotal: number | null
  }
  listings: {
    published: number
    paused: number
    drafts: number
    hubs: number
    customDomains: number
  }
  reservations: {
    last30Days: number
    upcoming: number
    collectedLast30DaysMinor: number
    currency: string
  }
  attention: AdminAttentionItem[]
}

export type AdminPaymentStatus = 'succeeded' | 'failed' | 'pending' | 'refunded' | 'partially_refunded' | 'disputed'

export type AdminPaymentRow = {
  id: string
  source: 'subscription' | 'reservation' | 'other'
  status: AdminPaymentStatus
  amountMinor: number
  refundedMinor: number
  currency: string
  createdAtISO: string
  title: string
  detail: string | null
  payer: string | null
  account: { userId: string | null; label: string } | null
  failureReason: string | null
  stripeUrl: string | null
}

export type AdminPayments = {
  generatedAtISO: string
  stripeAvailable: boolean
  periodDays: number
  totals: {
    succeededCount: number
    succeededMinor: number
    failedCount: number
    refundedMinor: number
    disputedCount: number
    currency: string
  }
  rows: AdminPaymentRow[]
}

export type ServiceStatus = 'up' | 'degraded' | 'down' | 'disabled' | 'unknown'
export type ServiceGroup = 'entry' | 'core' | 'data' | 'external'
export type ServiceId =
  | 'public'
  | 'proxy'
  | 'certificates'
  | 'site'
  | 'api'
  | 'database'
  | 'scraping'
  | 'jobs'
  | 'calendars'
  | 'stripe'
  | 'clerk'
  | 'email'
  | 'imagekit'
  | 'maps'

export type ServiceFact = { label: string; value: string; tone?: 'good' | 'warn' | 'bad' }

export type HealthBucket = {
  startISO: string
  status: ServiceStatus | 'none'
  samples: number
  avgLatencyMs: number | null
}

export type ServiceHealth = {
  id: ServiceId
  group: ServiceGroup
  label: string
  role: string
  status: ServiceStatus
  latencyMs: number | null
  summary: string
  facts: ServiceFact[]
  checkedAtISO: string | null
  everyMs: number
  uptime24h: number | null
  history: HealthBucket[]
}

export type HealthIncident = {
  atISO: string
  serviceId: ServiceId
  label: string
  from: ServiceStatus
  to: ServiceStatus
  summary: string
}

export type JobHealth = {
  id: string
  label: string
  schedule: string
  running: boolean
  lastStartedAtISO: string | null
  lastDurationMs: number | null
  lastStatus: 'ok' | 'error' | null
  lastError: string | null
  nextRunAtISO: string | null
  runs: number
  failures: number
}

export type SystemHealth = {
  generatedAtISO: string
  monitoringSinceISO: string
  environment: 'production' | 'development' | 'test'
  overall: { status: ServiceStatus; up: number; degraded: number; down: number; disabled: number }
  services: ServiceHealth[]
  incidents: HealthIncident[]
  jobs: JobHealth[]
}

export type AdminUserAccess = {
  role: 'super_admin' | 'admin' | null
  roleSource: 'config' | 'clerk' | null
  banned: boolean
  locked: boolean
  known: boolean
}

export type FloorplanTicket = {
  available: boolean
  updatedAtISO: string | null
  sizeBytes: number | null
  /** Adresse de la carte, valable deux minutes ; null tant que la carte n'existe pas. */
  url: string | null
}

// --- Appels --------------------------------------------------------------------------------

export class AdminApiError extends Error {
  readonly status: number | null
  readonly code: string | null

  constructor(message: string, status: number | null, code: string | null) {
    super(message)
    this.name = 'AdminApiError'
    this.status = status
    this.code = code
  }
}

function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  const joined = BASE_API_URL ? `${BASE_API_URL}${normalized}` : normalized
  if (typeof window === 'undefined') return joined
  return new URL(joined, window.location.origin).toString()
}

async function getAxios() {
  const { default: axios } = await import('axios')
  return axios
}

async function authHeaders(): Promise<{ Authorization: string }> {
  const token = await getFreshAuthToken({ waitMs: 2500 })
  if (!token) throw new AdminApiError('Votre session a expiré. Reconnectez-vous.', 401, null)
  return { Authorization: `Bearer ${token}` }
}

function toAdminError(error: unknown, fallback: string): AdminApiError {
  const response = (error as { response?: { status?: unknown; data?: Record<string, unknown> } })?.response
  const status = typeof response?.status === 'number' ? response.status : null
  const message = typeof response?.data?.message === 'string' && response.data.message.trim() ? response.data.message.trim() : null
  const code = typeof response?.data?.code === 'string' ? response.data.code : null
  if (status === 401) return new AdminApiError('Votre session a expiré. Reconnectez-vous.', status, code)
  if (status === 403) return new AdminApiError('Cette page est réservée à l’administration d’IndieHost.', status, code)
  // Les messages en français de l'API (droits, Clerk) sont faits pour être affichés tels quels.
  if (status && status < 500 && message) return new AdminApiError(message, status, code)
  return new AdminApiError(fallback, status, code)
}

async function request<T>(method: 'GET' | 'POST' | 'PUT', path: string, options: { body?: unknown; params?: Record<string, string>; fallback: string }): Promise<T> {
  const axios = await getAxios()
  const headers = await authHeaders()
  try {
    const { data } = await axios.request<T>({
      method,
      url: apiUrl(path),
      headers,
      params: options.params,
      data: options.body,
      withCredentials: false,
    })
    return data
  } catch (error) {
    throw toAdminError(error, options.fallback)
  }
}

export function fetchAdminOverview(options?: { refresh?: boolean }): Promise<AdminOverview> {
  return request<AdminOverview>('GET', '/admin/overview', {
    params: options?.refresh ? { refresh: '1' } : undefined,
    fallback: 'Impossible de charger les chiffres pour le moment.',
  })
}

export function fetchAdminPayments(options?: { refresh?: boolean }): Promise<AdminPayments> {
  return request<AdminPayments>('GET', '/admin/payments', {
    params: options?.refresh ? { refresh: '1' } : undefined,
    fallback: 'Impossible de charger les paiements pour le moment.',
  })
}

export function fetchSystemHealth(): Promise<SystemHealth> {
  return request<SystemHealth>('GET', '/admin/system/health', { fallback: 'Impossible de lire l’état des services.' })
}

export async function refreshSystemHealth(): Promise<{ refreshed: boolean; snapshot: SystemHealth }> {
  return request<{ refreshed: boolean; snapshot: SystemHealth }>('POST', '/admin/system/health/refresh', {
    fallback: 'Impossible de relancer les contrôles.',
  })
}

export async function setAdminUserRole(clerkUserId: string, role: 'admin' | 'none'): Promise<AdminUserAccess> {
  const data = await request<{ access: AdminUserAccess }>('PUT', `/admin/users/${encodeURIComponent(clerkUserId)}/role`, {
    body: { role },
    fallback: 'Impossible de modifier les droits de ce compte.',
  })
  return data.access
}

export async function setAdminUserBlocked(clerkUserId: string, blocked: boolean): Promise<AdminUserAccess> {
  const data = await request<{ access: AdminUserAccess }>('PUT', `/admin/users/${encodeURIComponent(clerkUserId)}/blocked`, {
    body: { blocked },
    fallback: blocked ? 'Impossible de bloquer ce compte.' : 'Impossible de débloquer ce compte.',
  })
  return data.access
}

export async function createFloorplanTicket(): Promise<FloorplanTicket> {
  const data = await request<{ available: boolean; updatedAtISO: string | null; sizeBytes: number | null; token: string | null }>(
    'POST',
    '/admin/floorplan/ticket',
    { fallback: 'Impossible d’ouvrir la carte du code.' },
  )
  return {
    available: data.available,
    updatedAtISO: data.updatedAtISO,
    sizeBytes: data.sizeBytes,
    url: data.token ? apiUrl(`/admin/floorplan/view?token=${encodeURIComponent(data.token)}`) : null,
  }
}
