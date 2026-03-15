// File: src/domain/api/listingDomains.ts

import clerkToken from '@/utils/clerkToken'

export type ListingSubdomainAvailability = {
  slug: string
  available: boolean
  hostname: string
  publicUrl: string
  reason: string | null
}

export type ListingDomainRecord = {
  listingId: string
  subdomainSlug: string | null
  hostname: string | null
  publicUrl: string | null
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

function buildAuthHeaders() {
  const token = (clerkToken.value ?? '').trim()
  return token ? { Authorization: `Bearer ${token}` } : undefined
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

function normalizeDomainRecord(data: Record<string, unknown> | null | undefined): ListingDomainRecord {
  const payload = data ?? {}

  return {
    listingId: toTrimmedString(payload.listingId),
    subdomainSlug: toTrimmedString(payload.subdomainSlug) || null,
    hostname: toTrimmedString(payload.hostname) || null,
    publicUrl: toTrimmedString(payload.publicUrl) || null,
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
  const { data } = await axios.get<Record<string, unknown>>(url, {
    withCredentials: false,
    headers: buildAuthHeaders(),
  })
  return normalizeAvailability(data)
}

export async function fetchListingDomain(listingId: string): Promise<ListingDomainRecord> {
  const axios = await getAxios()
  const url = resolveUrl(buildListingDomainUrl(listingId))
  const { data } = await axios.get<Record<string, unknown>>(url, {
    withCredentials: false,
    headers: buildAuthHeaders(),
  })
  return normalizeDomainRecord(data)
}

export async function saveListingDomain(listingId: string, slug: string): Promise<ListingDomainRecord> {
  const axios = await getAxios()
  const url = resolveUrl(buildListingDomainUrl(listingId))
  const { data } = await axios.put<Record<string, unknown>>(url, { slug: slug.trim().toLowerCase() }, {
    withCredentials: false,
    headers: buildAuthHeaders(),
  })
  return normalizeDomainRecord(data)
}

export async function removeListingDomain(listingId: string): Promise<ListingDomainRecord> {
  const axios = await getAxios()
  const url = resolveUrl(buildListingDomainUrl(listingId))
  const { data } = await axios.delete<Record<string, unknown>>(url, {
    withCredentials: false,
    headers: buildAuthHeaders(),
  })
  return normalizeDomainRecord(data)
}
