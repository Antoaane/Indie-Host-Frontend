// File: src/domain/onboarding/listingOnboarding.ts

import type { RawListingBundle } from '@/domain/listings/types'

export type ListingOnboardingIntent = 'publish' | 'setup'
export type ListingOnboardingSource = 'wizard' | 'editor'

export type ListingOnboardingState = {
  version: 1
  source: ListingOnboardingSource
  email: string
  intent: ListingOnboardingIntent | null
  draft: RawListingBundle | null
  backendListingId: string | null
  connectMandatory: boolean
  connectAutoLaunchDone: boolean
  publishDecision: 'publish_now' | 'keep_blocked' | null
  createdAtISO: string
  updatedAtISO: string
}

const STORAGE_KEY = 'indiehost:onboarding:listing:v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asString(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function asIntent(value: unknown): ListingOnboardingIntent | null {
  if (value === 'publish') return 'publish'
  if (value === 'setup') return 'setup'
  return null
}

function asSource(value: unknown): ListingOnboardingSource {
  if (value === 'editor') return 'editor'
  return 'wizard'
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function isValidOnboardingEmailFormat(email: string): boolean {
  const normalized = asString(email)
  if (!normalized) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
}

export function buildListingOnboardingState(input: {
  source: ListingOnboardingSource
  email: string
  intent: ListingOnboardingIntent | null
  draft: RawListingBundle | null
  backendListingId?: string | null
  connectMandatory?: boolean
  connectAutoLaunchDone?: boolean
  publishDecision?: 'publish_now' | 'keep_blocked' | null
  createdAtISO?: string
}): ListingOnboardingState {
  const now = new Date().toISOString()
  return {
    version: 1,
    source: input.source,
    email: asString(input.email),
    intent: input.intent,
    draft: input.draft ?? null,
    backendListingId: asString(input.backendListingId) || null,
    connectMandatory: Boolean(input.connectMandatory),
    connectAutoLaunchDone: Boolean(input.connectAutoLaunchDone),
    publishDecision: input.publishDecision ?? null,
    createdAtISO: asString(input.createdAtISO) || now,
    updatedAtISO: now,
  }
}

export function readListingOnboardingState(): ListingOnboardingState | null {
  if (!canUseStorage()) return null

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!isRecord(parsed)) return null

    return {
      version: 1,
      source: asSource(parsed.source),
      email: asString(parsed.email),
      intent: asIntent(parsed.intent),
      draft: isRecord(parsed.draft) ? (parsed.draft as RawListingBundle) : null,
      backendListingId: asString(parsed.backendListingId) || null,
      connectMandatory: Boolean(parsed.connectMandatory),
      connectAutoLaunchDone: Boolean(parsed.connectAutoLaunchDone),
      publishDecision: parsed.publishDecision === 'publish_now' ? 'publish_now' : parsed.publishDecision === 'keep_blocked' ? 'keep_blocked' : null,
      createdAtISO: asString(parsed.createdAtISO) || new Date().toISOString(),
      updatedAtISO: asString(parsed.updatedAtISO) || new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function persistListingOnboardingState(state: ListingOnboardingState | null): void {
  if (!canUseStorage()) return

  if (!state) {
    window.localStorage.removeItem(STORAGE_KEY)
    return
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...state,
        updatedAtISO: new Date().toISOString(),
      }),
    )
  } catch {
    // Ignore storage quota/private mode errors.
  }
}

export function updateListingOnboardingState(
  updater: (current: ListingOnboardingState | null) => ListingOnboardingState | null,
): ListingOnboardingState | null {
  const current = readListingOnboardingState()
  const next = updater(current)
  persistListingOnboardingState(next)
  return next
}

export function clearListingOnboardingState(): void {
  persistListingOnboardingState(null)
}

export function isListingOnboardingQuery(value: unknown): boolean {
  const normalized = asString(value).toLowerCase()
  return normalized === 'listing' || normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

export function parseListingOnboardingIntentQuery(value: unknown): ListingOnboardingIntent | null {
  return asIntent(asString(value).toLowerCase())
}
