// File: src/domain/listings/cancellationPolicy.ts
//
// Copie miroir de backend/api/src/domains/bookings/cancellationPolicy.ts : toute modification doit être
// faite des deux côtés. L'API applique ce barème au remboursement ; le front l'annonce avant le paiement
// (Checkout), dans l'éditeur (CancellationPanel) et sur la confirmation de réservation.
//
// Modèle : une politique fixe un délai `days` (jours avant l'arrivée) et une retenue `feePercent`.
//   - à `days` jours ou plus de l'arrivée : remboursement intégral ;
//   - entre 24 h et `days` jours : `feePercent` % des sommes versées sont retenus ;
//   - à moins de 24 h : retenue majorée de CANCELLATION_LATE_FEE_STEP points (plafond 100 %) ;
//   - à partir du jour d'arrivée : plus d'annulation en ligne.
// Si l'hôte n'a pas activé `refundsEnabled`, la réservation est non remboursable : le voyageur peut
// annuler et libérer les dates, mais rien ne lui est reversé.

export type CancellationPolicyCode = 'flexible' | 'moderate' | 'strict' | 'custom'
export type CancellationPresetCode = Exclude<CancellationPolicyCode, 'custom'>
export type CancellationSeverity = 'low' | 'medium' | 'high'
export type CancellationStage = 'full_refund' | 'partial_refund' | 'late_cancellation' | 'after_arrival' | 'non_refundable'

/** Palier du barème : à `daysBefore` jours ou plus de l'arrivée, `refundPercent` % des sommes versées sont remboursés. */
export type CancellationTier = {
  daysBefore: number
  refundPercent: number
  stage: Extract<CancellationStage, 'full_refund' | 'partial_refund' | 'late_cancellation'>
}

export type CancellationPolicyDefinition = {
  code: CancellationPolicyCode
  /** Libellé français (féminin : « politique … »). */
  label: string
  description: string
  /** `null` pour `custom` : les valeurs viennent de l'hôte. */
  severity: CancellationSeverity | null
  /** Valeurs par défaut ; pour `custom`, celles appliquées quand l'hôte n'a rien saisi. */
  days: number
  feePercent: number
}

/** Préférences brutes de l'hôte (`bookings.pricing.cancellation`), lues sans confiance. */
export type CancellationSettingsInput = {
  policy?: unknown
  refundsEnabled?: unknown
  custom?: unknown
} | null | undefined

export type ResolvedCancellationPolicy = {
  policy: CancellationPolicyCode
  // Les remboursements au voyageur n'existent que si l'hôte les a autorisés dans ses préférences.
  refundsEnabled: boolean
  days: number
  feePercent: number
  lateFeePercent: number
  /** Paliers ordonnés du plus éloigné au plus proche de l'arrivée ; vide si non remboursable. */
  tiers: CancellationTier[]
}

export type CancellationOutcome = {
  stage: CancellationStage
  refundPercent: number
  retainedPercent: number
  /** Faux à partir du jour d'arrivée : l'annulation en ligne n'est plus possible. */
  canCancel: boolean
}

export const CANCELLATION_DAYS_MIN = 0
export const CANCELLATION_DAYS_MAX = 365
export const CANCELLATION_FEE_MIN = 0
export const CANCELLATION_FEE_MAX = 100
export const CANCELLATION_LATE_FEE_STEP = 20
/** En dessous de ce délai (en jours), c'est la retenue majorée qui s'applique. */
export const CANCELLATION_LATE_THRESHOLD_DAYS = 1
export const DEFAULT_CANCELLATION_POLICY: CancellationPolicyCode = 'flexible'
/** Politique dont les valeurs servent de secours à `custom` quand l'hôte n'a rien saisi. */
export const CUSTOM_FALLBACK_POLICY: CancellationPresetCode = 'moderate'

export const CANCELLATION_POLICIES: readonly CancellationPolicyDefinition[] = [
  {
    code: 'flexible',
    label: 'Flexible',
    description: 'Remboursement intégral jusqu’à 3 jours avant l’arrivée, puis 10 % retenus.',
    severity: 'low',
    days: 3,
    feePercent: 10,
  },
  {
    code: 'moderate',
    label: 'Modérée',
    description: 'Remboursement intégral jusqu’à 7 jours avant l’arrivée, puis 20 % retenus.',
    severity: 'medium',
    days: 7,
    feePercent: 20,
  },
  {
    code: 'strict',
    label: 'Stricte',
    description: 'Remboursement intégral jusqu’à 14 jours avant l’arrivée, puis 35 % retenus.',
    severity: 'high',
    days: 14,
    feePercent: 35,
  },
  {
    code: 'custom',
    label: 'Personnalisée',
    description: 'Délai et retenue fixés par l’hôte.',
    severity: null,
    days: 7,
    feePercent: 20,
  },
]

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const next = Number(value)
  if (!Number.isFinite(next)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(next)))
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function isCancellationPolicyCode(value: unknown): value is CancellationPolicyCode {
  return CANCELLATION_POLICIES.some((definition) => definition.code === value)
}

export function getCancellationPolicyDefinition(code: CancellationPolicyCode): CancellationPolicyDefinition {
  return CANCELLATION_POLICIES.find((definition) => definition.code === code)
    ?? CANCELLATION_POLICIES.find((definition) => definition.code === DEFAULT_CANCELLATION_POLICY)!
}

export function getCancellationPolicyLabel(code: CancellationPolicyCode): string {
  return getCancellationPolicyDefinition(code).label
}

export function resolveLateFeePercent(feePercent: number): number {
  return clampInteger(feePercent + CANCELLATION_LATE_FEE_STEP, CANCELLATION_FEE_MIN, CANCELLATION_FEE_MAX, CANCELLATION_FEE_MAX)
}

/**
 * Paliers appliqués pour un délai et une retenue donnés, du plus éloigné au plus proche de l'arrivée.
 * Un délai inférieur à 24 h n'a pas de palier partiel : remboursement intégral jusqu'à 24 h, puis retenue majorée.
 */
export function buildCancellationTiers(days: number, feePercent: number): CancellationTier[] {
  const safeDays = clampInteger(days, CANCELLATION_DAYS_MIN, CANCELLATION_DAYS_MAX, CANCELLATION_DAYS_MIN)
  const safeFee = clampInteger(feePercent, CANCELLATION_FEE_MIN, CANCELLATION_FEE_MAX, CANCELLATION_FEE_MIN)
  const lateFee = resolveLateFeePercent(safeFee)

  const tiers: CancellationTier[] = [
    {
      daysBefore: Math.max(CANCELLATION_LATE_THRESHOLD_DAYS, safeDays),
      refundPercent: CANCELLATION_FEE_MAX,
      stage: 'full_refund',
    },
  ]
  if (safeDays > CANCELLATION_LATE_THRESHOLD_DAYS) {
    tiers.push({
      daysBefore: CANCELLATION_LATE_THRESHOLD_DAYS,
      refundPercent: CANCELLATION_FEE_MAX - safeFee,
      stage: 'partial_refund',
    })
  }
  tiers.push({
    daysBefore: 0,
    refundPercent: CANCELLATION_FEE_MAX - lateFee,
    stage: 'late_cancellation',
  })

  return tiers
}

/** Normalise les préférences de l'hôte : politique, remboursements, valeurs personnalisées bornées. */
export function resolveCancellationPolicy(settings: CancellationSettingsInput | unknown): ResolvedCancellationPolicy {
  const raw = asRecord(settings)
  const policy = isCancellationPolicyCode(raw.policy) ? raw.policy : DEFAULT_CANCELLATION_POLICY
  const definition = getCancellationPolicyDefinition(policy)
  const fallback = policy === 'custom' ? getCancellationPolicyDefinition(CUSTOM_FALLBACK_POLICY) : definition

  const custom = asRecord(raw.custom)
  const days = policy === 'custom'
    ? clampInteger(custom.days, CANCELLATION_DAYS_MIN, CANCELLATION_DAYS_MAX, fallback.days)
    : fallback.days
  const feePercent = policy === 'custom'
    ? clampInteger(custom.feePercent, CANCELLATION_FEE_MIN, CANCELLATION_FEE_MAX, fallback.feePercent)
    : fallback.feePercent
  const refundsEnabled = raw.refundsEnabled === true

  return {
    policy,
    refundsEnabled,
    days,
    feePercent,
    lateFeePercent: resolveLateFeePercent(feePercent),
    tiers: refundsEnabled ? buildCancellationTiers(days, feePercent) : [],
  }
}

/** Paliers effectivement appliqués (vide si l'hôte n'autorise pas les remboursements). */
export function resolveCancellationTiers(settings: CancellationSettingsInput | unknown): CancellationTier[] {
  return resolveCancellationPolicy(settings).tiers
}

/**
 * Issue d'une annulation à `daysBeforeArrival` jours (fractionnaires acceptés) de l'arrivée.
 * Précédence identique à l'API : arrivée dépassée, puis non remboursable, puis les paliers.
 */
export function resolveCancellationOutcome(policy: ResolvedCancellationPolicy, daysBeforeArrival: number): CancellationOutcome {
  if (!Number.isFinite(daysBeforeArrival) || daysBeforeArrival <= 0) {
    return { stage: 'after_arrival', refundPercent: 0, retainedPercent: CANCELLATION_FEE_MAX, canCancel: false }
  }
  if (!policy.refundsEnabled) {
    return { stage: 'non_refundable', refundPercent: 0, retainedPercent: CANCELLATION_FEE_MAX, canCancel: true }
  }

  const tier = policy.tiers.find((candidate) => daysBeforeArrival >= candidate.daysBefore)
    ?? policy.tiers[policy.tiers.length - 1]
  if (!tier) {
    return { stage: 'non_refundable', refundPercent: 0, retainedPercent: CANCELLATION_FEE_MAX, canCancel: true }
  }

  return {
    stage: tier.stage,
    refundPercent: tier.refundPercent,
    retainedPercent: CANCELLATION_FEE_MAX - tier.refundPercent,
    canCancel: true,
  }
}

/** Pourcentage des sommes versées remboursé si le voyageur annule à `daysBeforeArrival` jours de l'arrivée. */
export function computeRefundPercent(settings: CancellationSettingsInput | unknown, daysBeforeArrival: number): number {
  return resolveCancellationOutcome(resolveCancellationPolicy(settings), daysBeforeArrival).refundPercent
}

function formatDays(days: number): string {
  return `${days} jour${days > 1 ? 's' : ''}`
}

/**
 * Phrases françaises décrivant le barème appliqué, dans l'ordre chronologique (du plus tôt au plus tard).
 * Mêmes phrases dans l'éditeur, au paiement et sur la confirmation.
 */
export function describeCancellationPolicy(settings: unknown): string[] {
  const policy = isResolvedCancellationPolicy(settings) ? settings : resolveCancellationPolicy(settings)

  if (!policy.refundsEnabled) {
    return [
      'L’hôte n’accepte pas de remboursement : en cas d’annulation de votre part, les sommes versées ne sont pas remboursées.',
      'Si l’hôte annule le séjour, vous êtes remboursé intégralement.',
    ]
  }

  const lines: string[] = []
  policy.tiers.forEach((tier) => {
    if (tier.stage === 'full_refund') {
      lines.push(tier.daysBefore > CANCELLATION_LATE_THRESHOLD_DAYS
        ? `Remboursement intégral jusqu’à ${formatDays(tier.daysBefore)} avant l’arrivée.`
        : 'Remboursement intégral jusqu’à 24 h avant l’arrivée.')
    } else if (tier.stage === 'partial_refund') {
      lines.push(`Ensuite, ${CANCELLATION_FEE_MAX - tier.refundPercent} % des sommes versées sont retenus.`)
    } else {
      lines.push(`À moins de 24 h de l’arrivée, ${CANCELLATION_FEE_MAX - tier.refundPercent} % sont retenus.`)
    }
  })
  lines.push('À partir du jour d’arrivée, l’annulation en ligne n’est plus possible.')

  return lines
}

/** Libellé court du barème pour un titre : « politique flexible », « réservation non remboursable »… */
export function summarizeCancellationPolicy(settings: unknown): string {
  const policy = isResolvedCancellationPolicy(settings) ? settings : resolveCancellationPolicy(settings)
  if (!policy.refundsEnabled) return 'réservation non remboursable'
  return `politique ${getCancellationPolicyLabel(policy.policy).toLowerCase()}`
}

function isResolvedCancellationPolicy(value: unknown): value is ResolvedCancellationPolicy {
  const raw = asRecord(value)
  return Array.isArray(raw.tiers) && typeof raw.refundsEnabled === 'boolean' && typeof raw.lateFeePercent === 'number'
}
