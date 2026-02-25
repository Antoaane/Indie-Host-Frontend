// File: src/domain/listings/perks.ts

import { getAmenityIconName } from '@/utils/amenitiesIcons'
import type { RawAmenity, RawBookings, RawCore, RawPerkSetting } from '@/domain/listings/types'

export type PerkCandidateSource = 'amenity' | 'setting'

export type PerkCandidate = {
  source: PerkCandidateSource
  sourceId: string
  name: string
  description?: string
  icon: string
  score: number
  priority: number
  order: number
}

type AmenityPerkDefaults = {
  perkEligible: boolean
  perkScore: number
  perkPriority?: number
}

const AMENITY_PERK_DEFAULTS: Record<string, AmenityPerkDefaults> = {
  PRIVATE_DOCK_ACCESS: { perkEligible: true, perkScore: 95 },
  PANORAMIC_LAKE_VIEW: { perkEligible: true, perkScore: 93 },
  BEACH_ACCESS: { perkEligible: true, perkScore: 90 },
  WALK_TO_BEACH: { perkEligible: true, perkScore: 88 },
  MONT_BLANC_VIEW: { perkEligible: true, perkScore: 92 },
  WIFI: { perkEligible: true, perkScore: 91 },
  SELF_CHECK_IN: { perkEligible: true, perkScore: 94 },
  SMART_LOCK: { perkEligible: true, perkScore: 87 },
  DEDICATED_WORKSPACE: { perkEligible: true, perkScore: 82 },
  REVERSIBLE_AIR_CONDITIONING: { perkEligible: true, perkScore: 80 },
  HEATED_POOL: { perkEligible: true, perkScore: 90 },
  FREE_PARKING_ON_PREMISES: { perkEligible: true, perkScore: 79 },
  PRIVATE_PARKING: { perkEligible: true, perkScore: 78 },
  WOOD_TERRACE: { perkEligible: true, perkScore: 84 },
  EQUIPPED_KITCHEN: { perkEligible: true, perkScore: 77 },
}

type CancellationPerkDefaults = {
  name: string
  description: string
  icon: string
  score: number
  priority: number
}

const CANCELLATION_POLICY_PERK_DEFAULTS: Record<string, CancellationPerkDefaults> = {
  flexible: {
    name: 'Annulation flexible',
    description: 'Remboursement facilité en cas de changement de plan.',
    icon: 'rotate-ccw',
    score: 96,
    priority: 0,
  },
  moderate: {
    name: 'Annulation modérée',
    description: 'Conditions équilibrées pour l’hôte et le voyageur.',
    icon: 'shield-check',
    score: 78,
    priority: 0,
  },
  strict: {
    name: 'Annulation stricte',
    description: 'Politique plus encadrée pour les changements tardifs.',
    icon: 'shield-alert',
    score: 55,
    priority: 0,
  },
  custom: {
    name: 'Annulation personnalisée',
    description: 'Conditions d’annulation définies spécifiquement.',
    icon: 'sliders-horizontal',
    score: 70,
    priority: 1,
  },
}

function toFiniteNumber(value: unknown, fallback?: number): number | undefined {
  const next = Number(value)
  if (Number.isFinite(next)) return next
  if (typeof fallback === 'number' && Number.isFinite(fallback)) return fallback
  return undefined
}

function normalizeString(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function resolveAmenityDefaults(amenityId: unknown): AmenityPerkDefaults | null {
  const id = normalizeString(amenityId)
  if (!id) return null
  return AMENITY_PERK_DEFAULTS[id] ?? null
}

export function getAmenityPerkDefaults(amenityId: unknown): AmenityPerkDefaults | null {
  return resolveAmenityDefaults(amenityId)
}

function resolveAmenityPerkCandidate(amenity: RawAmenity, order: number): PerkCandidate | null {
  const defaults = resolveAmenityDefaults(amenity.id)
  const eligible =
    typeof amenity.perkEligible === 'boolean'
      ? amenity.perkEligible
      : Boolean(defaults?.perkEligible)
  if (!eligible) return null

  const score = toFiniteNumber(amenity.perkScore, defaults?.perkScore)
  if (typeof score !== 'number') return null

  const priority = toFiniteNumber(amenity.perkPriority, defaults?.perkPriority) ?? 0
  const name = normalizeString(amenity.name)
  if (!name) return null

  const amenityId = normalizeString(amenity.id)
  const icon = getAmenityIconName(amenityId) ?? 'star'
  const sourceId = amenityId || `index-${order}`
  const description = normalizeString(amenity.description) || undefined

  return {
    source: 'amenity',
    sourceId,
    name,
    description,
    icon,
    score,
    priority,
    order,
  }
}

function resolveSettingPerkCandidate(setting: RawPerkSetting, order: number): PerkCandidate | null {
  if (setting.enabled === false) return null
  if (!setting.perkEligible) return null

  const score = toFiniteNumber(setting.perkScore)
  if (typeof score !== 'number') return null

  const name = normalizeString(setting.name)
  const icon = normalizeString(setting.icon)
  if (!name || !icon) return null

  const priority = toFiniteNumber(setting.perkPriority) ?? 0
  const sourceId = normalizeString(setting.id) || `index-${order}`
  const description = normalizeString(setting.description) || undefined

  return {
    source: 'setting',
    sourceId,
    name,
    description,
    icon,
    score,
    priority,
    order,
  }
}

function resolveCancellationPerkCandidate(bookings: Partial<RawBookings> | null | undefined, order: number): PerkCandidate | null {
  const pricing = bookings?.pricing ?? {}
  const cancellation = pricing.cancellation
  if (!cancellation) return null

  const policy = normalizeString(cancellation.policy).toLowerCase() || 'flexible'
  const defaults = CANCELLATION_POLICY_PERK_DEFAULTS[policy] ?? CANCELLATION_POLICY_PERK_DEFAULTS.flexible
  const eligible = typeof cancellation.perkEligible === 'boolean' ? cancellation.perkEligible : true
  if (!eligible) return null

  const score = toFiniteNumber(cancellation.perkScore, defaults.score)
  if (typeof score !== 'number') return null

  const priority = toFiniteNumber(cancellation.perkPriority, defaults.priority) ?? 0
  const name = normalizeString(cancellation.perkName) || defaults.name
  const description = normalizeString(cancellation.perkDescription) || defaults.description
  const icon = normalizeString(cancellation.perkIcon) || defaults.icon

  return {
    source: 'setting',
    sourceId: 'pricing.cancellation',
    name,
    description,
    icon,
    score,
    priority,
    order,
  }
}

export function buildPerkCandidates(params: {
  core?: Partial<RawCore> | null
  bookings?: Partial<RawBookings> | null
}): PerkCandidate[] {
  const candidates: PerkCandidate[] = []
  const amenitiesOrderBase = 0
  const settingsOrderBase = (params.core?.amenities ?? []).length + amenitiesOrderBase

  ;(params.core?.amenities ?? []).forEach((amenity, index) => {
    const candidate = resolveAmenityPerkCandidate(amenity as RawAmenity, amenitiesOrderBase + index)
    if (candidate) candidates.push(candidate)
  })

  ;(params.core?.perkSettings ?? []).forEach((setting, index) => {
    const candidate = resolveSettingPerkCandidate(setting as RawPerkSetting, settingsOrderBase + index)
    if (candidate) candidates.push(candidate)
  })

  const cancellationOrder = settingsOrderBase + (params.core?.perkSettings?.length ?? 0)
  const cancellationCandidate = resolveCancellationPerkCandidate(params.bookings, cancellationOrder)
  if (cancellationCandidate) candidates.push(cancellationCandidate)

  return candidates
}

export function selectTopPerkCandidates(candidates: PerkCandidate[], limit = 2): PerkCandidate[] {
  if (limit <= 0) return []

  const sorted = [
    ...candidates,
  ].sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score
    if (a.priority !== b.priority) return b.priority - a.priority
    if (a.order !== b.order) return a.order - b.order
    if (a.source !== b.source) return a.source.localeCompare(b.source)
    return a.sourceId.localeCompare(b.sourceId)
  })

  return sorted.slice(0, limit)
}
