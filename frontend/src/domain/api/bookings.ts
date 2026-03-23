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

export type BookingReservationConfirmation = {
  guideAccessKey: string
  guideUrl: string
}

export type CreateBookingReservationResponse = {
  reservationId: string
  listingId: string
  confirmation?: BookingReservationConfirmation
  messaging?: {
    conversationId: string
  }
}

export type BookingConfirmationPayload = {
  reservationId: string
  listingId: string
  stay: {
    startISO: string
    endISO: string
    nights: number
    totalAmount: number
    currency: string
  }
  host: {
    name: string
    status: string | null
    avatar: string | null
    catalogLink: string | null
    phone: string | null
    email: string | null
    assistance: string | null
    contacts: string | null
  }
  guide: {
    url: string
    guideAccessKey: string
    isActive: boolean
    activeAfterISO: string
  }
  messaging: {
    conversationId: string
  }
}

export type ReservationGuideAccessPayload = {
  guideKey: string
  status: 'locked' | 'active'
  activeAfterISO: string
  reservation: {
    id: string
    guestName: string
    startISO: string
    endISO: string
    nights: number
  }
  listing: {
    id: string
  }
  host: {
    name: string
    status: string | null
    avatar: string | null
    email: string | null
    phone: string | null
  }
  guide: {
    url: string
    relativeUrl: string
  }
  messaging: {
    conversationId: string
  }
}

export type GuideConversationMessagePayload = {
  id: string
  author: 'host' | 'guest'
  body: string
  sentAt: string
  state: 'sent' | 'delivered' | 'read'
}

export type GuideConversationPayload = {
  conversationId: string
  reservationId: string
  messages: GuideConversationMessagePayload[]
}

export type GuideConversationSendPayload = {
  conversationId: string
  message: GuideConversationMessagePayload
  messages: GuideConversationMessagePayload[]
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

function encodePathSegment(value: string): string {
  return encodeURIComponent(value.trim())
}

function buildBookingResourceUrl(reservationId: string, suffix: string): string {
  const base = buildBookingsUrl().replace(/\/+$/, '')
  const normalizedSuffix = suffix.startsWith('/') ? suffix : `/${suffix}`
  return `${base}/${encodePathSegment(reservationId)}${normalizedSuffix}`
}

function buildGuideResourceUrl(guideKey: string): string {
  const base = buildBookingsUrl().replace(/\/+$/, '')
  return `${base}/guides/${encodePathSegment(guideKey)}`
}

function buildGuideConversationResourceUrl(guideKey: string): string {
  return `${buildGuideResourceUrl(guideKey)}/conversation`
}

function buildGuideConversationMessagesResourceUrl(guideKey: string): string {
  return `${buildGuideConversationResourceUrl(guideKey)}/messages`
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

function base64UrlEncode(value: string): string {
  if (typeof btoa !== 'function') return ''

  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function isLocalDevHost(): boolean {
  if (typeof window === 'undefined') return true
  const hostname = window.location.hostname.toLowerCase()
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost')
}

function buildDevelopmentGuestToken(): string | null {
  if (!import.meta.env.DEV) return null
  if (!isLocalDevHost()) return null

  const now = Math.floor(Date.now() / 1000)
  const header = base64UrlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = base64UrlEncode(JSON.stringify({
    sub: 'guest-checkout',
    iat: now,
    exp: now + (30 * 60),
    iss: 'indiehost-dev-guest',
  }))

  if (!header || !payload) return null
  return `${header}.${payload}.dev`
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const maybeAxiosData = (error as { response?: { data?: unknown } }).response?.data
    if (maybeAxiosData && typeof maybeAxiosData === 'object') {
      const message = (maybeAxiosData as { message?: unknown }).message
      if (typeof message === 'string' && message.trim()) return message.trim()
    }
    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage.trim()
  }
  return fallback
}

function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toOptionalString(value: unknown): string | null {
  const normalized = toTrimmedString(value)
  return normalized || null
}

function toNonNegativeNumber(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.round(parsed))
}

function toNonNegativeInt(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.trunc(parsed))
}

function normalizeBookingConfirmation(payload: Record<string, unknown> | null | undefined): BookingConfirmationPayload {
  const source = payload ?? {}
  const stay = (source.stay && typeof source.stay === 'object') ? source.stay as Record<string, unknown> : {}
  const host = (source.host && typeof source.host === 'object') ? source.host as Record<string, unknown> : {}
  const guide = (source.guide && typeof source.guide === 'object') ? source.guide as Record<string, unknown> : {}
  const messaging = (source.messaging && typeof source.messaging === 'object') ? source.messaging as Record<string, unknown> : {}

  return {
    reservationId: toTrimmedString(source.reservationId),
    listingId: toTrimmedString(source.listingId),
    stay: {
      startISO: toTrimmedString(stay.startISO),
      endISO: toTrimmedString(stay.endISO),
      nights: Math.max(1, toNonNegativeInt(stay.nights, 1)),
      totalAmount: toNonNegativeNumber(stay.totalAmount),
      currency: toTrimmedString(stay.currency) || 'eur',
    },
    host: {
      name: toTrimmedString(host.name) || 'Hote',
      status: toOptionalString(host.status),
      avatar: toOptionalString(host.avatar),
      catalogLink: toOptionalString(host.catalogLink),
      phone: toOptionalString(host.phone),
      email: toOptionalString(host.email),
      assistance: toOptionalString(host.assistance),
      contacts: toOptionalString(host.contacts),
    },
    guide: {
      url: toTrimmedString(guide.url),
      guideAccessKey: toTrimmedString(guide.guideAccessKey || guide.guideAccessToken),
      isActive: Boolean(guide.isActive),
      activeAfterISO: toTrimmedString(guide.activeAfterISO),
    },
    messaging: {
      conversationId: toTrimmedString(messaging.conversationId),
    },
  }
}

function normalizeGuideAccessPayload(payload: Record<string, unknown> | null | undefined): ReservationGuideAccessPayload {
  const source = payload ?? {}
  const reservation = (source.reservation && typeof source.reservation === 'object') ? source.reservation as Record<string, unknown> : {}
  const listing = (source.listing && typeof source.listing === 'object') ? source.listing as Record<string, unknown> : {}
  const host = (source.host && typeof source.host === 'object') ? source.host as Record<string, unknown> : {}
  const guide = (source.guide && typeof source.guide === 'object') ? source.guide as Record<string, unknown> : {}
  const messaging = (source.messaging && typeof source.messaging === 'object') ? source.messaging as Record<string, unknown> : {}
  const rawStatus = toTrimmedString(source.status)
  const status: ReservationGuideAccessPayload['status'] = rawStatus === 'active' ? 'active' : 'locked'

  return {
    guideKey: toTrimmedString(source.guideKey),
    status,
    activeAfterISO: toTrimmedString(source.activeAfterISO),
    reservation: {
      id: toTrimmedString(reservation.id),
      guestName: toTrimmedString(reservation.guestName) || 'Voyageur',
      startISO: toTrimmedString(reservation.startISO),
      endISO: toTrimmedString(reservation.endISO),
      nights: Math.max(1, toNonNegativeInt(reservation.nights, 1)),
    },
    listing: {
      id: toTrimmedString(listing.id),
    },
    host: {
      name: toTrimmedString(host.name) || 'Hote',
      status: toOptionalString(host.status),
      avatar: toOptionalString(host.avatar),
      email: toOptionalString(host.email),
      phone: toOptionalString(host.phone),
    },
    guide: {
      url: toTrimmedString(guide.url),
      relativeUrl: toTrimmedString(guide.relativeUrl),
    },
    messaging: {
      conversationId: toTrimmedString(messaging.conversationId),
    },
  }
}

function normalizeGuideConversationMessage(
  payload: Record<string, unknown> | null | undefined,
): GuideConversationMessagePayload {
  const source = payload ?? {}
  const rawAuthor = toTrimmedString(source.author || source.authorRole)
  const author: GuideConversationMessagePayload['author'] = rawAuthor === 'host' ? 'host' : 'guest'
  const rawState = toTrimmedString(source.state)
  const state: GuideConversationMessagePayload['state'] =
    rawState === 'read'
      ? 'read'
      : rawState === 'delivered'
        ? 'delivered'
        : 'sent'

  return {
    id: toTrimmedString(source.id),
    author,
    body: toTrimmedString(source.body),
    sentAt: toTrimmedString(source.sentAt),
    state,
  }
}

function normalizeGuideConversationPayload(
  payload: Record<string, unknown> | null | undefined,
): GuideConversationPayload {
  const source = payload ?? {}
  const rawMessages = Array.isArray(source.messages) ? source.messages : []
  const messages = rawMessages
    .map((item) => normalizeGuideConversationMessage(item as Record<string, unknown>))
    .filter((message) => message.id && message.body)

  return {
    conversationId: toTrimmedString(source.conversationId),
    reservationId: toTrimmedString(source.reservationId),
    messages,
  }
}

function normalizeGuideConversationSendPayload(
  payload: Record<string, unknown> | null | undefined,
): GuideConversationSendPayload {
  const source = payload ?? {}
  const messageSource = (source.message && typeof source.message === 'object') ? source.message as Record<string, unknown> : {}
  const rawMessages = Array.isArray(source.messages) ? source.messages : []
  const messages = rawMessages
    .map((item) => normalizeGuideConversationMessage(item as Record<string, unknown>))
    .filter((message) => message.id && message.body)

  return {
    conversationId: toTrimmedString(source.conversationId),
    message: normalizeGuideConversationMessage(messageSource),
    messages,
  }
}

export async function createBookingReservation(input: CreateBookingReservationInput): Promise<CreateBookingReservationResponse> {
  const axios = await getAxios()
  const token = await getAuthToken()
  const requestToken = token || buildDevelopmentGuestToken()

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
    const headers = requestToken
      ? {
          Authorization: `Bearer ${requestToken}`,
        }
      : undefined

    const { data } = await axios.post<CreateBookingReservationResponse>(resolveUrl(buildBookingsUrl()), payload, {
      withCredentials: false,
      ...(headers ? { headers } : {}),
    })

    return data
  } catch (error) {
    throw new Error(resolveErrorMessage(error, 'Impossible de créer la réservation.'))
  }
}

export async function fetchBookingConfirmation(input: {
  reservationId: string
  token: string
}): Promise<BookingConfirmationPayload> {
  const reservationId = input.reservationId.trim()
  const token = input.token.trim()

  if (!reservationId) {
    throw new Error('Identifiant de réservation manquant.')
  }
  if (!token) {
    throw new Error('Jeton de confirmation manquant.')
  }

  const axios = await getAxios()

  try {
    const { data } = await axios.get<Record<string, unknown>>(
      resolveUrl(buildBookingResourceUrl(reservationId, 'confirmation')),
      {
        withCredentials: false,
        params: { token },
      },
    )

    return normalizeBookingConfirmation(data)
  } catch (error) {
    throw new Error(resolveErrorMessage(error, 'Impossible de charger la confirmation de réservation.'))
  }
}

export function buildReservationStayIcalUrl(input: {
  reservationId: string
  guideAccessKey: string
}): string {
  const reservationId = input.reservationId.trim()
  const guideAccessKey = input.guideAccessKey.trim()
  if (!reservationId || !guideAccessKey) return ''

  const base = buildBookingResourceUrl(reservationId, 'stay.ics')
  const separator = base.includes('?') ? '&' : '?'
  return resolveUrl(`${base}${separator}token=${encodeURIComponent(guideAccessKey)}`)
}

export async function fetchReservationGuideAccess(input: {
  guideKey: string
}): Promise<ReservationGuideAccessPayload> {
  const guideKey = input.guideKey.trim()
  if (!guideKey) {
    throw new Error('Identifiant du guide manquant.')
  }

  const axios = await getAxios()

  try {
    const { data } = await axios.get<Record<string, unknown>>(
      resolveUrl(buildGuideResourceUrl(guideKey)),
      {
        withCredentials: false,
      },
    )
    return normalizeGuideAccessPayload(data)
  } catch (error) {
    throw new Error(resolveErrorMessage(error, 'Impossible de charger le guide de réservation.'))
  }
}

export async function fetchGuideConversation(input: {
  guideKey: string
}): Promise<GuideConversationPayload> {
  const guideKey = input.guideKey.trim()
  if (!guideKey) {
    throw new Error('Identifiant du guide manquant.')
  }

  const axios = await getAxios()

  try {
    const { data } = await axios.get<Record<string, unknown>>(
      resolveUrl(buildGuideConversationResourceUrl(guideKey)),
      {
        withCredentials: false,
      },
    )
    return normalizeGuideConversationPayload(data)
  } catch (error) {
    throw new Error(resolveErrorMessage(error, 'Impossible de charger la conversation du guide.'))
  }
}

export async function sendGuideConversationMessage(input: {
  guideKey: string
  body: string
}): Promise<GuideConversationSendPayload> {
  const guideKey = input.guideKey.trim()
  const body = input.body.trim()
  if (!guideKey) {
    throw new Error('Identifiant du guide manquant.')
  }
  if (!body) {
    throw new Error('Message vide.')
  }

  const axios = await getAxios()

  try {
    const { data } = await axios.post<Record<string, unknown>>(
      resolveUrl(buildGuideConversationMessagesResourceUrl(guideKey)),
      {
        body,
      },
      {
        withCredentials: false,
      },
    )
    return normalizeGuideConversationSendPayload(data)
  } catch (error) {
    throw new Error(resolveErrorMessage(error, 'Impossible d envoyer le message.'))
  }
}
