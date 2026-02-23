// File: src/domain/payments/checkoutPayment.ts

import type { ReservationPayload } from '@/views/ListingView/types/reservation'

export type CheckoutPaymentChoice = 'full' | 'split' | 'cash'
export type CheckoutDeferredMode = 'none' | 'online' | 'cash'

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
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return value.trim()
}

export function resolveReservationMethodLabel(choice: CheckoutPaymentChoice): string {
  if (choice === 'cash') return 'En ligne + Espèces'
  return 'En ligne'
}

export function resolveCheckoutPaymentBreakdown({
  totalAmount,
  choice,
  arrivalDateISO,
}: {
  totalAmount: number
  choice: CheckoutPaymentChoice
  arrivalDateISO?: string | null
}): CheckoutPaymentBreakdown {
  const normalizedTotal = roundCurrency(toNonNegativeAmount(totalAmount))
  const ratio = CHARGE_NOW_RATIO[choice] ?? CHARGE_NOW_RATIO.full
  const chargeNowAmount = roundCurrency(normalizedTotal * ratio)
  const deferredAmount = Math.max(0, normalizedTotal - chargeNowAmount)
  const deferredMode: CheckoutDeferredMode =
    choice === 'full'
      ? 'none'
      : choice === 'cash'
        ? 'cash'
        : 'online'

  return {
    choice,
    totalAmount: normalizedTotal,
    chargeNowAmount,
    deferredAmount,
    deferredMode,
    deferredDueDateISO: deferredMode === 'none' ? null : normalizeIsoDate(arrivalDateISO),
    reservationMethodLabel: resolveReservationMethodLabel(choice),
  }
}

export function buildStripeReservationMetadata({
  listingId,
  reservation,
  breakdown,
}: {
  listingId: string
  reservation: ReservationPayload
  breakdown: CheckoutPaymentBreakdown
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

  if (breakdown.deferredDueDateISO) {
    metadata.payment_deferred_due_date = breakdown.deferredDueDateISO
  }

  return metadata
}
