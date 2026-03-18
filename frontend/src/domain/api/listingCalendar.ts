// File: src/domain/api/listingCalendar.ts

import clerkToken from '@/utils/clerkToken'

export type ListingCalendarSyncSource = {
  id: string
  listingId: string
  name: string | null
  sourceUrl: string | null
  timezone: string | null
  lastStatus: string | null
  lastError: string | null
  lastSyncedAt: string | null
  isFresh: boolean
  staleAfter: string | null
}

export type ListingCalendarSyncResult = {
  syncId: string
  name: string | null
  sourceUrl: string | null
  status: 'synced' | 'throttled' | 'failed' | 'skipped'
  changed: boolean
  importedEvents: number
  blockingEvents: number
  lastSyncedAt: string | null
  lastStatus: string | null
  lastError: string | null
  isFresh: boolean
  staleAfter: string | null
}

const RAW_BASE_API_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim()
const BASE_API_URL = normalizeApiBaseUrl(RAW_BASE_API_URL)
export const isListingCalendarApiConfigured = Boolean(BASE_API_URL)

function normalizeApiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '')
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

function buildAuthHeaders() {
  const token = (clerkToken.value ?? '').trim()
  return token ? { Authorization: `Bearer ${token}` } : undefined
}

async function getAxios() {
  const { default: axios } = await import('axios')
  return axios
}

function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toOptionalString(value: unknown): string | null {
  const next = toTrimmedString(value)
  return next || null
}

function normalizeSource(payload: Record<string, unknown> | null | undefined): ListingCalendarSyncSource {
  const source = payload ?? {}

  return {
    id: toTrimmedString(source.id),
    listingId: toTrimmedString(source.listingId),
    name: toOptionalString(source.name),
    sourceUrl: toOptionalString(source.sourceUrl),
    timezone: toOptionalString(source.timezone),
    lastStatus: toOptionalString(source.lastStatus),
    lastError: toOptionalString(source.lastError),
    lastSyncedAt: toOptionalString(source.lastSyncedAt),
    isFresh: Boolean(source.isFresh),
    staleAfter: toOptionalString(source.staleAfter),
  }
}

function normalizeSyncStatus(value: unknown): ListingCalendarSyncResult['status'] {
  if (value === 'synced' || value === 'throttled' || value === 'failed' || value === 'skipped') {
    return value
  }

  return 'failed'
}

function normalizeSyncResult(payload: Record<string, unknown> | null | undefined): ListingCalendarSyncResult {
  const result = payload ?? {}

  return {
    syncId: toTrimmedString(result.syncId),
    name: toOptionalString(result.name),
    sourceUrl: toOptionalString(result.sourceUrl),
    status: normalizeSyncStatus(result.status),
    changed: Boolean(result.changed),
    importedEvents: Number.isFinite(Number(result.importedEvents)) ? Math.max(0, Math.trunc(Number(result.importedEvents))) : 0,
    blockingEvents: Number.isFinite(Number(result.blockingEvents)) ? Math.max(0, Math.trunc(Number(result.blockingEvents))) : 0,
    lastSyncedAt: toOptionalString(result.lastSyncedAt),
    lastStatus: toOptionalString(result.lastStatus),
    lastError: toOptionalString(result.lastError),
    isFresh: Boolean(result.isFresh),
    staleAfter: toOptionalString(result.staleAfter),
  }
}

function encodeSegment(value: string): string {
  return encodeURIComponent(value.trim())
}

function buildListingCalendarSourcesUrl(listingId: string): string {
  return joinUrl(BASE_API_URL, `/calendar/listings/${encodeSegment(listingId)}/sources`)
}

function buildListingCalendarImportUrl(listingId: string): string {
  return joinUrl(BASE_API_URL, `/calendar/listings/${encodeSegment(listingId)}/import`)
}

function buildListingCalendarSyncUrl(listingId: string, syncId: string): string {
  return joinUrl(BASE_API_URL, `/calendar/listings/${encodeSegment(listingId)}/sources/${encodeSegment(syncId)}/sync`)
}

function buildListingCalendarExportPath(listingId: string): string {
  return joinUrl(BASE_API_URL, `/calendar/listings/${encodeSegment(listingId)}.ics`)
}

export function buildListingCalendarExportUrl(listingId: string): string {
  if (!BASE_API_URL || !listingId.trim()) return ''
  return resolveUrl(buildListingCalendarExportPath(listingId))
}

export async function fetchListingCalendarSyncSources(listingId: string): Promise<ListingCalendarSyncSource[]> {
  if (!listingId.trim()) return []

  const axios = await getAxios()
  const { data } = await axios.get<Array<Record<string, unknown>>>(
    resolveUrl(buildListingCalendarSourcesUrl(listingId)),
    {
      withCredentials: false,
      headers: buildAuthHeaders(),
    },
  )

  return Array.isArray(data)
    ? data.map((item) => normalizeSource(item))
    : []
}

export async function importListingCalendarSource(input: {
  listingId: string
  name?: string | null
  url: string
}): Promise<ListingCalendarSyncResult> {
  const listingId = input.listingId.trim()
  const url = input.url.trim()
  const name = (input.name ?? '').trim()

  const axios = await getAxios()
  const { data } = await axios.post<Record<string, unknown>>(
    resolveUrl(buildListingCalendarImportUrl(listingId)),
    {
      ...(name ? { name } : {}),
      url,
    },
    {
      withCredentials: false,
      headers: buildAuthHeaders(),
    },
  )

  return normalizeSyncResult(data)
}

export async function syncListingCalendarSource(input: {
  listingId: string
  syncId: string
}): Promise<ListingCalendarSyncResult> {
  const listingId = input.listingId.trim()
  const syncId = input.syncId.trim()

  const axios = await getAxios()
  const { data } = await axios.post<Record<string, unknown>>(
    resolveUrl(buildListingCalendarSyncUrl(listingId, syncId)),
    {},
    {
      withCredentials: false,
      headers: buildAuthHeaders(),
    },
  )

  return normalizeSyncResult(data)
}
