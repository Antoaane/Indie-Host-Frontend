// File: src/domain/payments/checkoutPayment.ts

import type { ReservationPayload } from '@/views/ListingView/types/reservation'
import { toUtcDay } from '@/domain/listings/bookings'
import {
  resolveCheckoutPaymentChoice,
  type CheckoutPaymentChoice,
  type ListingPaymentRules,
} from '@/domain/listings/reservationRules'

export type CheckoutDeferredMode = 'none' | 'online' | 'cash'
export type { CheckoutPaymentChoice } from '@/domain/listings/reservationRules'

export type CheckoutPaymentBreakdown = {
  choice: CheckoutPaymentChoice
  totalAmount: number
  chargeNowAmount: number
  deferredAmount: number
  deferredMode: CheckoutDeferredMode
  deferredDueDateISO: string | null
  reservationMethodLabel: string
}

const CHARGE_NOW_RATIO: Record<CheckoutPaymentChoice, number> = {
  full: 1,
  split: 0.5,
  cash: 0.25,
}

function toNonNegativeAmount(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return parsed
}

function roundCurrency(value: number): number {
  return Math.round(value)
}

function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const normalized = value.trim()
  return toUtcDay(normalized) === null ? null : normalized
}

function normalizeRatio(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.min(1, parsed))
}

function toIsoFromUtcDay(value: number): string {
  return new Date(value).toISOString().slice(0, 10)
}

function subtractDays(isoDate: string, days: number): string {
  const base = toUtcDay(isoDate)
  if (base === null) return isoDate
  const normalizedDays = Math.max(0, Math.trunc(days))
  const DAY_MS = 24 * 60 * 60 * 1000
  return toIsoFromUtcDay(base - normalizedDays * DAY_MS)
}

function resolveDeferredDueDate({
  choice,
  arrivalDateISO,
  paymentRules,
}: {
  choice: CheckoutPaymentChoice
  arrivalDateISO?: string | null
  paymentRules?: ListingPaymentRules | null
}): string | null {
  if (choice === 'full') return null

  const normalizedArrival = normalizeIsoDate(arrivalDateISO)
  if (!normalizedArrival) return null

  if (!paymentRules || paymentRules.source === 'legacy') {
    return normalizedArrival
  }

  if (choice === 'cash') {
    return normalizedArrival
  }

  if (paymentRules.balance.type === 'before' && paymentRules.balance.days > 0) {
    return subtractDays(normalizedArrival, paymentRules.balance.days)
  }

  return normalizedArrival
}

function resolveDeferredMode({
  choice,
}: {
  choice: CheckoutPaymentChoice
}): CheckoutDeferredMode {
  if (choice === 'full') return 'none'
  if (choice === 'cash') return 'cash'
  return 'online'
}

export function resolveReservationMethodLabel(choice: CheckoutPaymentChoice): string {
  if (choice === 'cash') return 'En ligne + Espèces'
  return 'En ligne'
}

export function resolveCheckoutPaymentBreakdown({
  totalAmount,
  choice,
  arrivalDateISO,
  paymentRules,
}: {
  totalAmount: number
  choice: CheckoutPaymentChoice
  arrivalDateISO?: string | null
  paymentRules?: ListingPaymentRules | null
}): CheckoutPaymentBreakdown {
  const normalizedTotal = roundCurrency(toNonNegativeAmount(totalAmount))
  const effectiveChoice = paymentRules
    ? resolveCheckoutPaymentChoice(choice, paymentRules) ?? choice
    : choice
  const ratio = normalizeRatio(
    paymentRules?.chargeNowRatioByChoice?.[effectiveChoice] ?? CHARGE_NOW_RATIO[effectiveChoice] ?? CHARGE_NOW_RATIO.full,
    CHARGE_NOW_RATIO.full,
  )
  const chargeNowAmount = roundCurrency(normalizedTotal * ratio)
  const deferredAmount = Math.max(0, normalizedTotal - chargeNowAmount)
  const deferredMode = resolveDeferredMode({
    choice: effectiveChoice,
  })

  return {
    choice: effectiveChoice,
    totalAmount: normalizedTotal,
    chargeNowAmount,
    deferredAmount,
    deferredMode,
    deferredDueDateISO: resolveDeferredDueDate({
      choice: effectiveChoice,
      arrivalDateISO,
      paymentRules,
    }),
    reservationMethodLabel: resolveReservationMethodLabel(effectiveChoice),
  }
}

export function buildStripeReservationMetadata({
  listingId,
  reservation,
  breakdown,
  paymentRules,
}: {
  listingId: string
  reservation: ReservationPayload
  breakdown: CheckoutPaymentBreakdown
  paymentRules?: ListingPaymentRules | null
}): Record<string, string> {
  const metadata: Record<string, string> = {
    listing_id: listingId,
    payment_choice: breakdown.choice,
    payment_total_amount: String(breakdown.totalAmount),
    payment_charge_now_amount: String(breakdown.chargeNowAmount),
    payment_deferred_amount: String(breakdown.deferredAmount),
    payment_deferred_mode: breakdown.deferredMode,
    reservation_start: reservation.startISO ?? '',
    reservation_end: reservation.endISO ?? '',
    reservation_nights: String(Math.max(0, Number(reservation.nights ?? 0) || 0)),
    reservation_adults: String(Math.max(0, Number(reservation.occupants.adults ?? 0) || 0)),
    reservation_children: String(Math.max(0, Number(reservation.occupants.children ?? 0) || 0)),
    reservation_babies: String(Math.max(0, Number(reservation.occupants.babies ?? 0) || 0)),
    reservation_animals: String(Math.max(0, Number(reservation.occupants.animals ?? 0) || 0)),
    reservation_pmr: String(Math.max(0, Number(reservation.occupants.pmr ?? 0) || 0)),
  }

  if (paymentRules) {
    metadata.payment_rule_source = paymentRules.source
    metadata.payment_rule_mode = paymentRules.mode
    metadata.payment_rule_deposit_percent = String(paymentRules.depositPercent)
    metadata.payment_rule_balance_type = paymentRules.balance.type
    metadata.payment_rule_balance_days = String(paymentRules.balance.days)
    metadata.payment_rule_methods = [
      paymentRules.methods.card ? 'card' : null,
      paymentRules.methods.sepa ? 'sepa' : null,
      paymentRules.methods.cash ? 'cash' : null,
    ].filter(Boolean).join(',')
  }

  if (breakdown.deferredDueDateISO) {
    metadata.payment_deferred_due_date = breakdown.deferredDueDateISO
  }

  return metadata
}
