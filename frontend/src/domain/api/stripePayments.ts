// File: src/domain/api/stripePayments.ts

import type { ReservationPayload } from '@/views/ListingView/types/reservation'
import type { CheckoutPaymentBreakdown } from '@/domain/payments/checkoutPayment'
import clerkToken from '@/utils/clerkToken'

type ParsedEndpoint = {
  origin?: string
  path?: string
}

export type CreateStripePaymentIntentInput = {
  listingId: string
  connectedAccountId: string
  reservation: ReservationPayload
  breakdown: CheckoutPaymentBreakdown
  currency?: string
  metadata?: Record<string, string>
}

export type StripePaymentIntentSession = {
  id: string
  clientSecret: string
  status: string
  currency: string
  connectedAccountId: string
}

const RAW_STRIPE_API_BASE_URL = (import.meta.env.VITE_STRIPE_API_BASE_URL ?? import.meta.env.VITE_API_BASE_URL ?? '').trim()
const BASE_API_URL = normalizeApiBaseUrl(RAW_STRIPE_API_BASE_URL)
const PAYMENT_INTENT_PATH = normalizePath((import.meta.env.VITE_STRIPE_PAYMENT_INTENT_PATH ?? '/payments/stripe/payment-intents').trim())

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

  if (import.meta.env.DEV) {
    try {
      const parsed = new URL(trimmed)
      return parsed.pathname.replace(/\/$/, '') || '/'
    } catch {
      // Keep the original value for relative URLs.
    }
  }

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

function buildCreateIntentUrl(): string {
  if (/^https?:\/\//i.test(PAYMENT_INTENT_PATH)) return PAYMENT_INTENT_PATH

  const parsedBase = parseEndpoint(BASE_API_URL)
  if (!parsedBase.path && !parsedBase.origin) return PAYMENT_INTENT_PATH

  const basePath = parsedBase.path ?? BASE_API_URL
  return joinUrl(basePath, PAYMENT_INTENT_PATH)
}

function toStringValue(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
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

async function getAxios() {
  const { default: axios } = await import('axios')
  return axios
}

async function getAuthToken(): Promise<string | null> {
  const token = (clerkToken.value ?? '').trim()
  if (token) return token
  return waitForClerkToken({ timeoutMs: 2000, pollEveryMs: 50 })
}

function normalizeSessionResponse(
  data: Record<string, unknown> | null | undefined,
  fallback: {
    connectedAccountId: string
    currency: string
  },
): StripePaymentIntentSession {
  const payload = data ?? {}
  const id =
    toStringValue(payload.paymentIntentId) ||
    toStringValue(payload.payment_intent_id) ||
    toStringValue(payload.id)

  const clientSecret =
    toStringValue(payload.clientSecret) ||
    toStringValue(payload.client_secret)

  if (!id || !clientSecret) {
    throw new Error('Réponse Stripe invalide (id/client_secret manquant).')
  }

  return {
    id,
    clientSecret,
    status: toStringValue(payload.status) || 'requires_payment_method',
    currency: toStringValue(payload.currency) || fallback.currency,
    connectedAccountId:
      toStringValue(payload.connectedAccountId) ||
      toStringValue(payload.connected_account_id) ||
      fallback.connectedAccountId,
  }
}

export async function createStripePaymentIntent(input: CreateStripePaymentIntentInput): Promise<StripePaymentIntentSession> {
  const axios = await getAxios()
  const token = await getAuthToken()
  const url = resolveUrl(buildCreateIntentUrl())
  const currency = toStringValue(input.currency || 'eur').toLowerCase()

  const requestPayload = {
    listingId: input.listingId,
    connectedAccountId: input.connectedAccountId,
    currency,
    reservation: {
      startISO: input.reservation.startISO,
      endISO: input.reservation.endISO,
      nights: input.reservation.nights,
      total: input.reservation.total,
      occupants: input.reservation.occupants,
      fees: input.reservation.fees,
      pricing: input.reservation.pricing,
    },
    payment: {
      choice: input.breakdown.choice,
      totalAmount: input.breakdown.totalAmount,
      chargeNowAmount: input.breakdown.chargeNowAmount,
      deferredAmount: input.breakdown.deferredAmount,
      deferredMode: input.breakdown.deferredMode,
      deferredDueDateISO: input.breakdown.deferredDueDateISO,
    },
    metadata: input.metadata ?? {},
  }

  const { data } = await axios.post<Record<string, unknown>>(url, requestPayload, {
    withCredentials: false,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })

  return normalizeSessionResponse(data, {
    connectedAccountId: input.connectedAccountId,
    currency,
  })
}
