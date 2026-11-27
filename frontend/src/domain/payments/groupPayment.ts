// File: src/domain/payments/groupPayment.ts

// Paiement à plusieurs : règles sans appel à l'API (partage du montant, conditions, échéance).
// Copie de `backend/api/src/domains/bookings/groupPaymentRules.ts` : toute évolution se fait des
// deux côtés. Contrôle : `cd backend/api && npx tsx --tsconfig ../../frontend/tsconfig.json scripts/group-payment-smoke.ts`.

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

/** Délai laissé au groupe pour régler toutes les parts, à partir de la réservation. */
export const GROUP_PAYMENT_WINDOW_HOURS = 72
/** Rappels envoyés aux amis qui n'ont pas réglé : heures restantes avant l'échéance. */
export const GROUP_PAYMENT_REMINDER_HOURS_BEFORE = [48, 24, 6] as const
/** L'arrivée doit être au moins à ce nombre de jours : le groupe a 72 h pour régler. */
export const GROUP_PAYMENT_MIN_LEAD_DAYS = 5
export const GROUP_PAYMENT_MIN_PAYERS = 2
export const GROUP_PAYMENT_MAX_PAYERS = 12
/** Part minimale, en centimes. */
export const GROUP_PAYMENT_MIN_SHARE_MINOR = 500

export type GroupPaymentBlockReason =
  | 'disabled'
  | 'card_required'
  | 'too_close'
  | 'not_enough_adults'
  | 'amount_too_small'

export type GroupPaymentOffer = {
  available: boolean
  reason: GroupPaymentBlockReason | null
  minPayers: number
  maxPayers: number
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toUtcDay(iso: string): number | null {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return null
  return Date.UTC(year, month - 1, day)
}

/** Réglage de l'hôte : `bookings.pricing.payment.group.enabled`, désactivé sans réglage. */
export function isGroupPaymentEnabled(pricing: unknown): boolean {
  if (!isPlainObject(pricing) || !isPlainObject(pricing.payment)) return false
  const group = pricing.payment.group
  return isPlainObject(group) && group.enabled === true
}

/**
 * Parts en centimes, l'organisateur en premier. Les amis paient tous la même part, arrondie au
 * centime inférieur ; l'organisateur prend les centimes restants (100,00 € à trois : 33,34 €, puis
 * 33,33 € et 33,33 €). La somme des parts vaut toujours le montant.
 */
export function splitGroupAmount(totalMinor: number, payers: number): number[] {
  const total = Math.max(0, Math.trunc(totalMinor))
  const count = Math.max(1, Math.trunc(payers))
  const base = Math.floor(total / count)
  const shares = Array.from({ length: count }, () => base)
  shares[0] = total - base * (count - 1)
  return shares
}

/**
 * Nombre de payeurs au plus : douze, pas plus que d'adultes, et 5 € au moins par part. Vaut aussi
 * quand l'organisateur ajoute une personne pendant les 72 h.
 */
export function resolveGroupMaxPayers(input: { adults: number; chargeNowAmountMinor: number }): number {
  const maxByAdults = Math.min(GROUP_PAYMENT_MAX_PAYERS, Math.max(0, Math.trunc(input.adults)))
  const maxByAmount = Math.floor(Math.max(0, input.chargeNowAmountMinor) / GROUP_PAYMENT_MIN_SHARE_MINOR)
  return Math.max(0, Math.min(maxByAdults, maxByAmount))
}

/** Jours pleins entre aujourd'hui et l'arrivée (dates « AAAA-MM-JJ »). */
export function daysUntilArrival(startISO: string, todayISO: string): number | null {
  const start = toUtcDay(startISO)
  const today = toUtcDay(todayISO)
  if (start === null || today === null) return null
  return Math.round((start - today) / DAY_MS)
}

/**
 * Le paiement à plusieurs est-il proposé pour ce séjour, et pour combien de payeurs ?
 * `chargeNowAmountMinor` : montant à régler en ligne à la réservation (acompte ou total).
 */
export function resolveGroupPaymentOffer(input: {
  enabled: boolean
  cardAccepted: boolean
  startISO: string
  todayISO: string
  adults: number
  chargeNowAmountMinor: number
  /** Jours de marge sur le délai (l'API compte en UTC, le voyageur dans son fuseau). */
  leadToleranceDays?: number
}): GroupPaymentOffer {
  const maxByAdults = Math.min(GROUP_PAYMENT_MAX_PAYERS, Math.max(0, Math.trunc(input.adults)))
  const maxByAmount = Math.floor(Math.max(0, input.chargeNowAmountMinor) / GROUP_PAYMENT_MIN_SHARE_MINOR)
  const maxPayers = Math.min(maxByAdults, maxByAmount)
  const blocked = (reason: GroupPaymentBlockReason): GroupPaymentOffer => ({
    available: false,
    reason,
    minPayers: GROUP_PAYMENT_MIN_PAYERS,
    maxPayers: Math.max(0, maxPayers),
  })

  if (!input.enabled) return blocked('disabled')
  if (!input.cardAccepted) return blocked('card_required')

  const lead = daysUntilArrival(input.startISO, input.todayISO)
  const minLead = GROUP_PAYMENT_MIN_LEAD_DAYS - Math.max(0, input.leadToleranceDays ?? 0)
  if (lead === null || lead < minLead) return blocked('too_close')
  if (maxByAdults < GROUP_PAYMENT_MIN_PAYERS) return blocked('not_enough_adults')
  if (maxByAmount < GROUP_PAYMENT_MIN_PAYERS) return blocked('amount_too_small')

  return { available: true, reason: null, minPayers: GROUP_PAYMENT_MIN_PAYERS, maxPayers }
}

export function resolveGroupPaymentExpiry(createdAt: Date): Date {
  return new Date(createdAt.getTime() + GROUP_PAYMENT_WINDOW_HOURS * HOUR_MS)
}

/** « 48 h », « 2 h 30 », « 12 min » : temps restant avant l'échéance. */
export function formatGroupTimeLeft(msLeft: number): string {
  const minutes = Math.max(0, Math.floor(msLeft / 60_000))
  if (minutes < 60) return `${Math.max(1, minutes)} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours >= 12 || rest === 0) return `${hours} h`
  return `${hours} h ${String(rest).padStart(2, '0')}`
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function normalizeParticipantEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) return null
  return email
}

/** Pourquoi le paiement à plusieurs n'est pas proposé pour ce séjour (rien quand l'hôte ne l'a pas activé). */
export function describeGroupPaymentBlock(reason: GroupPaymentBlockReason | null): string | null {
  if (reason === 'too_close') {
    return `Le paiement à plusieurs se réserve au moins ${GROUP_PAYMENT_MIN_LEAD_DAYS} jours avant l’arrivée : votre groupe a ${GROUP_PAYMENT_WINDOW_HOURS} h pour régler.`
  }
  if (reason === 'not_enough_adults') return 'Le paiement à plusieurs demande au moins deux adultes.'
  if (reason === 'amount_too_small') return 'Le montant à régler est trop faible pour être partagé.'
  return null
}
