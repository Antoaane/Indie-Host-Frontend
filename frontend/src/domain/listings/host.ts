// File: src/domain/listings/host.ts

import ownerUserJSON from '@/content/fr/user/user.json'
import type { RawHost } from '@/domain/listings/types'

export type RawOwnerUser = typeof ownerUserJSON

const HOST_DEFAULTS: RawHost = {
  name: '',
  status: '',
  seniority: 0,
  'global-note': 0,
  avatar: '',
  'catalog-link': '',
}

function parseText(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed ? trimmed : fallback
}

function parseNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value

  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }

  return fallback
}

export function buildHostFromOwnerUser(user: RawOwnerUser): RawHost {
  const publicProfile = user?.hosting?.publicProfile

  return {
    ...HOST_DEFAULTS,
    name: parseText(publicProfile?.displayName, HOST_DEFAULTS.name),
    status: parseText(publicProfile?.badge, HOST_DEFAULTS.status),
    seniority: Math.max(0, Math.round(parseNumber(publicProfile?.experienceMonths, HOST_DEFAULTS.seniority))),
    'global-note': Number(parseNumber(publicProfile?.rating, HOST_DEFAULTS['global-note']).toFixed(2)),
    avatar: parseText(publicProfile?.avatarUrl, HOST_DEFAULTS.avatar),
    'catalog-link': parseText(publicProfile?.catalogUrl, HOST_DEFAULTS['catalog-link']),
  }
}

const CANONICAL_HOST: RawHost = buildHostFromOwnerUser(ownerUserJSON)

export function getCanonicalHost(): RawHost {
  return { ...CANONICAL_HOST }
}
