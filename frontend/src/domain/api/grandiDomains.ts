// File: src/domain/api/grandiDomains.ts

import clerkToken from '@/utils/clerkToken'

type ParsedEndpoint = {
  origin?: string
  path?: string
}

export type GrandiDomainAvailability = {
  domain: string
  available: boolean
  premium: boolean
  priceCents: number | null
  currency: string
  reason: string | null
}

export type CreateGrandiCheckoutInput = {
  domain: string
  userId?: string | null
  customerEmail?: string | null
  successUrl?: string
  cancelUrl?: string
}

export type GrandiCheckoutSession = {
  id: string
  checkoutUrl: string
}

const RAW_GRANDI_API_BASE_URL = (import.meta.env.VITE_GRANDI_API_BASE_URL ?? import.meta.env.VITE_API_BASE_URL ?? '').trim()
const BASE_API_URL = normalizeApiBaseUrl(RAW_GRANDI_API_BASE_URL)
const AVAILABILITY_PATH = normalizePath((import.meta.env.VITE_GRANDI_AVAILABILITY_PATH ?? '/domains/grandi/availability').trim())
const CHECKOUT_PATH = normalizePath((import.meta.env.VITE_GRANDI_CHECKOUT_PATH ?? '/domains/grandi/checkout').trim())

function normalizePath(path: string): string {
  const trimmed = path.trim()
  if (!trimmed) return '/'
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function normalizePathPrefix(rawPath: string): string {
  const trimmed = rawPath.trim()
  if (!trimmed) return '/'
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  const noTrailingSlash = withLeadingSlash.replace(/\/+$/, '')
  return noTrailingSlash || '/'
}

function parseEndpoint(raw: string): ParsedEndpoint {
  const trimmed = raw.trim()
  if (!trimmed) return {}

  try {
    const parsed = new URL(trimmed)
    return {
      origin: parsed.origin,
      path: normalizePathPrefix(parsed.pathname),
    }
  } catch {
    if (trimmed.startsWith('/')) return { path: normalizePathPrefix(trimmed) }
    return {}
  }
}

function normalizeApiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/$/, '')
  if (!trimmed) return ''
  return trimmed
}

function joinUrl(base: string, path: string) {
  if (/^https?:\/\//i.test(path)) return path
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const normalizedBase = base.replace(/\/+$/, '')
  if (!normalizedBase) return normalizedPath
  return `${normalizedBase}${normalizedPath}`
}

function resolveUrl(url: string) {
  if (typeof window === 'undefined') return url
  return new URL(url, window.location.origin).toString()
}

function buildApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path

  const parsedBase = parseEndpoint(BASE_API_URL)
  if (parsedBase.origin) {
    const originWithPath = joinUrl(parsedBase.origin, parsedBase.path ?? '/')
    return joinUrl(originWithPath, path)
  }
  if (parsedBase.path) return joinUrl(parsedBase.path, path)
  if (!BASE_API_URL) return path
  return joinUrl(BASE_API_URL, path)
}

function toTrimmedString(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function toPrice(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value))
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return Math.max(0, Math.round(parsed))
  }
  return null
}

async function getAxios() {
  const { default: axios } = await import('axios')
  return axios
}

async function getAuthToken(): Promise<string | null> {
  const token = (clerkToken.value ?? '').trim()
  return token || null
}

function normalizeAvailabilityResponse(data: Record<string, unknown> | null | undefined): GrandiDomainAvailability {
  const payload = data ?? {}
  const domain =
    toTrimmedString(payload.domain) ||
    toTrimmedString(payload.fqdn)
  const currency = toTrimmedString(payload.currency) || 'EUR'

  return {
    domain,
    available: Boolean(payload.available),
    premium: Boolean(payload.premium),
    priceCents:
      toPrice(payload.priceCents) ??
      toPrice(payload.price_cents) ??
      toPrice(payload.price),
    currency,
    reason:
      toTrimmedString(payload.reason) ||
      toTrimmedString(payload.message) ||
      null,
  }
}

function normalizeCheckoutResponse(data: Record<string, unknown> | null | undefined): GrandiCheckoutSession {
  const payload = data ?? {}
  const id =
    toTrimmedString(payload.id) ||
    toTrimmedString(payload.sessionId) ||
    toTrimmedString(payload.session_id)
  const checkoutUrl =
    toTrimmedString(payload.checkoutUrl) ||
    toTrimmedString(payload.checkout_url) ||
    toTrimmedString(payload.url)

  if (!id || !checkoutUrl) {
    throw new Error('Réponse de checkout Grandi invalide.')
  }

  return {
    id,
    checkoutUrl,
  }
}

export async function fetchGrandiDomainAvailability(domain: string): Promise<GrandiDomainAvailability> {
  const axios = await getAxios()
  const token = await getAuthToken()
  const url = resolveUrl(buildApiUrl(AVAILABILITY_PATH))

  const { data } = await axios.get<Record<string, unknown>>(url, {
    params: { domain: domain.trim() },
    withCredentials: false,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })

  return normalizeAvailabilityResponse(data)
}

export async function createGrandiDomainCheckoutSession(input: CreateGrandiCheckoutInput): Promise<GrandiCheckoutSession> {
  const axios = await getAxios()
  const token = await getAuthToken()
  const url = resolveUrl(buildApiUrl(CHECKOUT_PATH))

  const requestPayload = {
    domain: input.domain.trim(),
    userId: toTrimmedString(input.userId),
    customerEmail: toTrimmedString(input.customerEmail),
    successUrl: toTrimmedString(input.successUrl),
    cancelUrl: toTrimmedString(input.cancelUrl),
  }

  const { data } = await axios.post<Record<string, unknown>>(url, requestPayload, {
    withCredentials: false,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })

  return normalizeCheckoutResponse(data)
}
