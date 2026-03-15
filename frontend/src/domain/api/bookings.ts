// File: src/domain/api/bookings.ts

import type { RawBookingReservation } from '@/domain/listings/types'
import clerkToken from '@/utils/clerkToken'

type ParsedEndpoint = {
  origin?: string
  path?: string
}

export type CreateBookingReservationInput = {
  listingId: string
  reservation: RawBookingReservation
}

export type CreateBookingReservationResponse = {
  reservationId: string
  listingId: string
}

const RAW_BOOKINGS_API_BASE_URL = (import.meta.env.VITE_BOOKINGS_API_BASE_URL ?? import.meta.env.VITE_API_BASE_URL ?? '').trim()
const BOOKINGS_API_BASE_URL = normalizeApiBaseUrl(RAW_BOOKINGS_API_BASE_URL)
const BOOKINGS_PATH = normalizePath((import.meta.env.VITE_BOOKINGS_PATH ?? '/bookings').trim())

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

function buildBookingsUrl(): string {
  if (/^https?:\/\//i.test(BOOKINGS_PATH)) return BOOKINGS_PATH

  const parsedBase = parseEndpoint(BOOKINGS_API_BASE_URL)
  if (parsedBase.origin) {
    const originWithPath = joinUrl(parsedBase.origin, parsedBase.path ?? '/')
    return joinUrl(originWithPath, BOOKINGS_PATH)
  }
  if (parsedBase.path) return joinUrl(parsedBase.path, BOOKINGS_PATH)
  if (!BOOKINGS_API_BASE_URL) return BOOKINGS_PATH
  return joinUrl(BOOKINGS_API_BASE_URL, BOOKINGS_PATH)
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

function resolveErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const maybeAxiosData = (error as { response?: { data?: unknown } }).response?.data
    if (maybeAxiosData && typeof maybeAxiosData === 'object') {
      const message = (maybeAxiosData as { message?: unknown }).message
      if (typeof message === 'string' && message.trim()) return message.trim()
    }
    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage.trim()
  }
  return 'Impossible de créer la réservation.'
}

export async function createBookingReservation(input: CreateBookingReservationInput): Promise<CreateBookingReservationResponse> {
  const axios = await getAxios()
  const token = await getAuthToken()

  if (!token) {
    throw new Error('Authentification requise pour confirmer la réservation.')
  }

  const payload = {
    id: input.reservation.id,
    listingId: input.listingId,
    start: input.reservation.start,
    end: input.reservation.end,
    nights: input.reservation.nights,
    guestName: input.reservation.guestName,
    guestAvatar: input.reservation.guestAvatar,
    message: input.reservation.message,
    internalNote: input.reservation.internalNote,
    guests: input.reservation.guests,
    payment: input.reservation.payment,
    contact: input.reservation.contact,
    createdAt: input.reservation.createdAt,
    messaging: input.reservation.messaging,
  }

  try {
    const { data } = await axios.post<CreateBookingReservationResponse>(resolveUrl(buildBookingsUrl()), payload, {
      withCredentials: false,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    return data
  } catch (error) {
    throw new Error(resolveErrorMessage(error))
  }
}

