// File: src/views/Management/utils/managementReservations.ts

import { getSynchronizedBookedDays, normalizeReservations, nightsBetween } from '@/domain/listings/bookings'
import type { RawBookingReservation, RawBookings, RawReservationMessaging, RawReservationPayment, UserListingCard } from '@/domain/listings/types'

const STRIPE_SETTLED_STATUSES = new Set([
  'succeeded',
  'processing',
  'requires_capture',
])

type ReservationPaymentStatus = 'paid' | 'pending'
type ReservationPaymentDeferredMode = 'none' | 'online' | 'cash'
type ReservationPaymentStripe = NonNullable<RawReservationPayment['stripe']>

export type ReservationGuests = {
  adults: number
  children: number
  infants: number
  pets: number
  pmr: number
}

export type ReservationPaymentManualEntry = {
  id: string
  amount: number
  date: string
  method: ReservationPaymentManualMethod
  comment: string
}

export const MANUAL_PAYMENT_METHODS = [
  { value: 'tpe_manual', label: 'TPE manuel' },
  { value: 'cash', label: 'Especes' },
  { value: 'bank_transfer', label: 'Virement' },
  { value: 'check', label: 'Cheque' },
  { value: 'other', label: 'Autre' },
] as const

export type ReservationPaymentManualMethod = typeof MANUAL_PAYMENT_METHODS[number]['value']

export type ReservationPayment = {
  total: number
  deposit: number
  balance: number
  status: ReservationPaymentStatus
  method: string
  baseDeposit: number
  manual: {
    entries: ReservationPaymentManualEntry[]
  }
  stripe?: ReservationPaymentStripe
  deferredMode: ReservationPaymentDeferredMode
  deferredDueDateISO: string | null
  stripeStatus: string
  isStripeBacked: boolean
  isStripeLocked: boolean
  canEditManualPayments: boolean
  onlinePaid: number
  manualPaid: number
  paidTotal: number
}

export type ReservationPaymentOverrides = {
  total?: number
  baseDeposit?: number
  manualEntries?: ReservationPaymentManualEntry[]
}

export type ReservationPaymentChoice = 'full' | 'split' | 'cash' | 'custom'
export type ReservationPaymentScheduleEntrySource = 'online' | 'manual' | 'deferred'
export type ReservationPaymentScheduleEntryStatus = 'paid' | 'pending'

export type ReservationPaymentScheduleEntry = {
  id: string
  source: ReservationPaymentScheduleEntrySource
  label: string
  amount: number
  status: ReservationPaymentScheduleEntryStatus
  dateISO: string | null
  manualEntryId?: string
  methodLabel?: string
  detail?: string
}

export type ReservationPaymentSchedule = {
  status: ReservationPaymentStatus
  statusLabel: string
  completionRate: number
  completionPercent: number
  completionLabel: string
  checkoutChoice: ReservationPaymentChoice
  checkoutChoiceLabel: string
  deferredModeLabel: string
  deferredDueDateISO: string | null
  total: number
  paidTotal: number
  balance: number
  onlinePaid: number
  manualPaid: number
  entries: ReservationPaymentScheduleEntry[]
}

export type Reservation = {
  id: string
  listingId: string
  start: string
  end: string
  nights: number
  guestName: string
  guestAvatar?: string
  message: string
  internalNote?: string
  guests: ReservationGuests
  payment: ReservationPayment
  contact?: RawBookingReservation['contact']
  createdAt?: string
  messaging?: RawReservationMessaging
}

export type LatestVisitForListing = {
  reservation: Reservation
  isInProgress: boolean
}

const DEFAULT_MANUAL_PAYMENT_METHOD: ReservationPaymentManualMethod = 'tpe_manual'

function toDateMs(iso?: string): number {
  if (!iso) return 0
  const [
    year,
    month,
    day,
  ] = iso.split('-').map(Number)
  if (!year || !month || !day) return 0

  const utc = Date.UTC(year, month - 1, day)
  const date = new Date(utc)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return 0
  }

  return utc
}

function toDateTimeMs(value?: string): number {
  if (!value) return 0
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? 0 : ms
}

function toUtcTodayMs(referenceDate = new Date()) {
  return Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate())
}

function reservationDistanceToReference(reservation: Reservation, referenceMs: number) {
  const start = toDateMs(reservation.start)
  const end = toDateMs(reservation.end)
  if (!start || !end || end < start) return Number.POSITIVE_INFINITY

  if (referenceMs < start) return start - referenceMs
  if (referenceMs > end) return referenceMs - end
  return 0
}

function compareReservationRelevance(a: Reservation, b: Reservation, referenceMs: number) {
  const distanceA = reservationDistanceToReference(a, referenceMs)
  const distanceB = reservationDistanceToReference(b, referenceMs)
  if (distanceA !== distanceB) return distanceA - distanceB

  const aStart = toDateMs(a.start)
  const aEnd = toDateMs(a.end)
  const bStart = toDateMs(b.start)
  const bEnd = toDateMs(b.end)

  const aFuture = aStart > referenceMs
  const bFuture = bStart > referenceMs
  if (aFuture !== bFuture) return aFuture ? -1 : 1

  if (aEnd !== bEnd) return bEnd - aEnd
  if (aStart !== bStart) return bStart - aStart
  return 0
}

function sumFees(bookings?: Partial<RawBookings> | null): number {
  const fees = bookings?.fees ?? []
  return fees.reduce((acc, fee) => acc + (Number(fee.amount ?? 0) || 0), 0)
}

function toNonNegativeInt(value: unknown, fallback = 0) {
  const next = Number(value)
  if (!Number.isFinite(next)) return fallback
  return Math.max(0, Math.trunc(next))
}

function normalizeGuests(input: Partial<ReservationGuests> | undefined): ReservationGuests {
  return {
    adults: Math.max(1, toNonNegativeInt(input?.adults, 1)),
    children: toNonNegativeInt(input?.children),
    infants: toNonNegativeInt(input?.infants),
    pets: toNonNegativeInt(input?.pets),
    pmr: toNonNegativeInt(input?.pmr),
  }
}

function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const trimmed = value.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [
      year,
      month,
      day,
    ] = trimmed.split('-').map(Number)
    if (!year || !month || !day) return null
    const utc = Date.UTC(year, month - 1, day)
    const date = new Date(utc)
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      return null
    }
    return trimmed
  }

  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function normalizeMethod(value: unknown): string {
  if (typeof value !== 'string') return 'Carte'
  const trimmed = value.trim()
  return trimmed ? trimmed : 'Carte'
}

function isCashLikeMethod(method: string): boolean {
  const normalized = method
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  return normalized.includes('cash') || normalized.includes('espece')
}

function normalizeStripeSnapshot(input: RawReservationPayment['stripe'] | undefined): ReservationPaymentStripe | undefined {
  if (!input || typeof input !== 'object') return undefined

  const paymentIntentId = typeof input.paymentIntentId === 'string' && input.paymentIntentId.trim() ? input.paymentIntentId.trim() : undefined
  const status = typeof input.status === 'string' && input.status.trim() ? input.status.trim().toLowerCase() : undefined
  const currency = typeof input.currency === 'string' && input.currency.trim() ? input.currency.trim().toLowerCase() : undefined
  const connectedAccountId = typeof input.connectedAccountId === 'string' && input.connectedAccountId.trim() ? input.connectedAccountId.trim() : undefined

  const paymentChoice = input.paymentChoice === 'full' || input.paymentChoice === 'split' || input.paymentChoice === 'cash' ? input.paymentChoice : undefined

  const deferredMode = input.deferredMode === 'none' || input.deferredMode === 'online' || input.deferredMode === 'cash' ? input.deferredMode : undefined

  const chargeNowAmount = Number.isFinite(Number(input.chargeNowAmount)) ? Math.max(0, Math.round(Number(input.chargeNowAmount))) : undefined
  const deferredAmount = Number.isFinite(Number(input.deferredAmount)) ? Math.max(0, Math.round(Number(input.deferredAmount))) : undefined

  const deferredDueDateISO = input.deferredDueDateISO === null ? null : normalizeIsoDate(input.deferredDueDateISO)

  if (!paymentIntentId && !status && !currency && !connectedAccountId && !paymentChoice && !deferredMode && chargeNowAmount === undefined && deferredAmount === undefined && deferredDueDateISO === null) {
    return undefined
  }

  return {
    ...(paymentIntentId ? { paymentIntentId } : {}),
    ...(status ? { status } : {}),
    ...(currency ? { currency } : {}),
    ...(connectedAccountId ? { connectedAccountId } : {}),
    ...(paymentChoice ? { paymentChoice } : {}),
    ...(deferredMode ? { deferredMode } : {}),
    ...(chargeNowAmount !== undefined ? { chargeNowAmount } : {}),
    ...(deferredAmount !== undefined ? { deferredAmount } : {}),
    ...(deferredDueDateISO !== null ? { deferredDueDateISO } : { deferredDueDateISO: null }),
  }
}

function normalizeManualPaymentMethod(value: unknown): ReservationPaymentManualMethod {
  if (typeof value !== 'string') return DEFAULT_MANUAL_PAYMENT_METHOD
  const normalized = value.trim().toLowerCase()

  if (normalized === 'tpe_manual' || normalized === 'cash' || normalized === 'bank_transfer' || normalized === 'check' || normalized === 'other') {
    return normalized
  }

  if (normalized === 'especes' || normalized === 'espece') return 'cash'
  if (normalized === 'virement') return 'bank_transfer'
  if (normalized === 'cheque' || normalized === 'chq') return 'check'
  if (normalized === 'tpe') return 'tpe_manual'

  return DEFAULT_MANUAL_PAYMENT_METHOD
}

export function resolveManualPaymentMethodLabel(method: ReservationPaymentManualMethod | string): string {
  const normalized = normalizeManualPaymentMethod(method)
  const match = MANUAL_PAYMENT_METHODS.find((item) => item.value === normalized)
  return match?.label ?? 'TPE manuel'
}

export function normalizeManualPaymentEntries(input: unknown): ReservationPaymentManualEntry[] {
  if (!Array.isArray(input)) return []

  const deduped = new Map<string, ReservationPaymentManualEntry>()

  input.forEach((item, index) => {
    if (!item || typeof item !== 'object') return
    const raw = item as Record<string, unknown>

    const amountRaw = Number(raw.amount)
    if (!Number.isFinite(amountRaw)) return
    const amount = Math.round(amountRaw)
    if (amount <= 0) return

    const date = normalizeIsoDate(raw.date)
    if (!date) return

    const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `manual-${date}-${index + 1}`
    const method = normalizeManualPaymentMethod(raw.method)
    const comment = typeof raw.comment === 'string' ? raw.comment.trim() : ''

    deduped.set(id, {
      id,
      amount,
      date,
      method,
      comment,
    })
  })

  return Array.from(deduped.values()).sort((a, b) => {
    const byDate = toDateMs(a.date) - toDateMs(b.date)
    if (byDate !== 0) return byDate
    return a.id.localeCompare(b.id)
  })
}

function resolveDeferredMode({ stripe, method, fallbackBalance }: { stripe?: ReservationPaymentStripe; method: string; fallbackBalance: number }): ReservationPaymentDeferredMode {
  if (stripe?.deferredMode === 'cash' || stripe?.deferredMode === 'online' || stripe?.deferredMode === 'none') {
    return stripe.deferredMode
  }

  if (stripe?.paymentChoice === 'cash') return 'cash'
  if (stripe?.paymentChoice === 'split') return 'online'
  if (stripe?.paymentChoice === 'full') return 'none'

  if (isCashLikeMethod(method)) return 'cash'
  return fallbackBalance > 0 ? 'online' : 'none'
}

function roundAndClamp(value: number, min: number, max: number): number {
  const rounded = Math.round(value)
  return Math.max(min, Math.min(max, rounded))
}

export function resolveReservationPayment(input: Partial<RawReservationPayment> | undefined, fallbackTotal: number, overrides?: ReservationPaymentOverrides): ReservationPayment {
  const method = normalizeMethod(input?.method)
  const stripe = normalizeStripeSnapshot(input?.stripe)
  const isStripeBacked = Boolean(stripe)

  const existingManualEntries = normalizeManualPaymentEntries(input?.manual?.entries)
  const existingManualPaid = existingManualEntries.reduce((acc, entry) => acc + entry.amount, 0)

  const fallbackBalance = Math.max(0, Number.isFinite(Number(input?.balance)) ? Math.round(Number(input?.balance)) : 0)
  const deferredMode = resolveDeferredMode({
    stripe,
    method,
    fallbackBalance,
  })

  const canEditManualPayments = !isStripeBacked || deferredMode === 'cash'
  const manualEntriesDraft = overrides?.manualEntries ? normalizeManualPaymentEntries(overrides.manualEntries) : existingManualEntries
  const manualEntries = canEditManualPayments ? manualEntriesDraft : existingManualEntries
  const manualPaid = manualEntries.reduce((acc, entry) => acc + entry.amount, 0)

  const stripeChargeNow = stripe?.chargeNowAmount
  const stripeDeferred = stripe?.deferredAmount
  const hasStripeBreakdown = stripeChargeNow !== undefined && stripeDeferred !== undefined
  const stripeTotal = hasStripeBreakdown ? stripeChargeNow + stripeDeferred : undefined

  const baseTotalFromInput = Number.isFinite(Number(input?.total)) ? Math.round(Number(input?.total)) : Math.round(fallbackTotal)
  const totalFromOverride = Number.isFinite(Number(overrides?.total)) ? Math.round(Number(overrides?.total)) : baseTotalFromInput
  const total = Math.max(0, isStripeBacked ? (stripeTotal ?? baseTotalFromInput) : totalFromOverride)

  const inputDeposit = Number.isFinite(Number(input?.deposit)) ? Math.round(Number(input?.deposit)) : Math.round(total * 0.3)
  const inferredBaseDeposit = Math.max(0, inputDeposit - existingManualPaid)

  const baseDepositFromOverride = Number.isFinite(Number(overrides?.baseDeposit)) ? Math.round(Number(overrides?.baseDeposit)) : inferredBaseDeposit
  const baseDepositUnlocked = roundAndClamp(baseDepositFromOverride, 0, total)
  const baseDepositLocked = roundAndClamp(stripeChargeNow ?? inferredBaseDeposit, 0, total)
  const baseDeposit = isStripeBacked ? baseDepositLocked : baseDepositUnlocked

  const stripeStatus = (stripe?.status ?? '').trim().toLowerCase()
  const stripeSettled = stripeStatus ? STRIPE_SETTLED_STATUSES.has(stripeStatus) : false

  const onlinePaid = isStripeBacked ? (stripeSettled ? baseDeposit : 0) : baseDeposit

  const paidTotal = roundAndClamp(onlinePaid + manualPaid, 0, total)
  const deposit = paidTotal
  const balance = Math.max(0, total - paidTotal)

  const status: ReservationPaymentStatus = (() => {
    if (isStripeBacked) {
      if (!stripeSettled) return 'pending'
      if (deferredMode === 'online' && balance > 0) return 'pending'
      return balance === 0 ? 'paid' : 'pending'
    }

    if (balance === 0) return 'paid'
    return 'pending'
  })()

  const deferredDueDateISO = deferredMode === 'none' ? null : normalizeIsoDate(stripe?.deferredDueDateISO)

  return {
    total,
    deposit,
    balance,
    status,
    method,
    baseDeposit,
    manual: {
      entries: manualEntries,
    },
    ...(stripe ? { stripe } : {}),
    deferredMode,
    deferredDueDateISO,
    stripeStatus,
    isStripeBacked,
    isStripeLocked: isStripeBacked,
    canEditManualPayments,
    onlinePaid,
    manualPaid,
    paidTotal,
  }
}

function clampRate(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function resolveCheckoutChoice(payment: ReservationPayment): ReservationPaymentChoice {
  const stripeChoice = payment.stripe?.paymentChoice
  if (stripeChoice === 'full' || stripeChoice === 'split' || stripeChoice === 'cash') return stripeChoice
  if (payment.deferredMode === 'none') return 'full'
  if (payment.deferredMode === 'cash') return 'cash'
  if (payment.deferredMode === 'online') return 'split'
  return 'custom'
}

function resolveCheckoutChoiceLabel(choice: ReservationPaymentChoice): string {
  if (choice === 'full') return 'Paiement intégral'
  if (choice === 'split') return 'Paiement en 2 temps'
  if (choice === 'cash') return 'Acompte + espèces'
  return 'Paiement configuré'
}

function resolveDeferredModeLabel(mode: ReservationPaymentDeferredMode): string {
  if (mode === 'none') return 'Aucun différé'
  if (mode === 'cash') return "Solde en espèces à l'arrivée"
  return 'Solde différé en ligne'
}

function resolveScheduleCompletionLabel({ completionPercent, paidTotal, total }: { completionPercent: number; paidTotal: number; total: number }): string {
  if (total <= 0) return 'Objectif non défini'
  if (completionPercent >= 100) return 'Objectif atteint'
  if (paidTotal <= 0) return 'Aucun règlement reçu'
  return `${completionPercent} % complété`
}

function resolveStripeStatusLabel(status: string): string {
  if (!status) return 'Statut Stripe inconnu'
  return `Stripe ${status}`
}

export function resolveReservationPaymentSchedule(
  payment: ReservationPayment,
  options?: {
    fallbackDueDateISO?: string | null
  },
): ReservationPaymentSchedule {
  const checkoutChoice = resolveCheckoutChoice(payment)
  const completionRate = clampRate(payment.total > 0 ? payment.paidTotal / payment.total : payment.status === 'paid' ? 1 : 0)
  const completionPercent = Math.round(completionRate * 100)
  const statusLabel = payment.status === 'paid' ? 'Payé' : 'En attente'
  const deferredDueDateISO = payment.deferredMode === 'none' ? null : normalizeIsoDate(payment.deferredDueDateISO ?? options?.fallbackDueDateISO)

  const entries: ReservationPaymentScheduleEntry[] = []

  const onlineTargetAmount = Math.max(payment.baseDeposit, payment.onlinePaid)
  const onlineStatus: ReservationPaymentScheduleEntryStatus = onlineTargetAmount <= 0 ? 'paid' : payment.onlinePaid >= onlineTargetAmount ? 'paid' : 'pending'
  const onlineLabel = checkoutChoice === 'full' ? 'Paiement en ligne' : 'Acompte en ligne'
  const onlineDetail = payment.isStripeBacked ? resolveStripeStatusLabel(payment.stripeStatus) : 'Montant encaissé'

  if (onlineTargetAmount > 0 || payment.isStripeBacked) {
    entries.push({
      id: 'online',
      source: 'online',
      label: onlineLabel,
      amount: onlineTargetAmount,
      status: onlineStatus,
      dateISO: null,
      detail: onlineDetail,
    })
  }

  payment.manual.entries.forEach((entry) => {
    entries.push({
      id: `manual-${entry.id}`,
      source: 'manual',
      label: 'Paiement manuel',
      amount: entry.amount,
      status: 'paid',
      dateISO: normalizeIsoDate(entry.date),
      manualEntryId: entry.id,
      methodLabel: resolveManualPaymentMethodLabel(entry.method),
      ...(entry.comment ? { detail: entry.comment } : {}),
    })
  })

  if (payment.deferredMode !== 'none' || payment.balance > 0) {
    entries.push({
      id: 'deferred',
      source: 'deferred',
      label: payment.deferredMode === 'cash' ? 'Solde à régler en espèces' : 'Solde à régler',
      amount: payment.balance,
      status: payment.balance > 0 ? 'pending' : 'paid',
      dateISO: deferredDueDateISO,
      detail: resolveDeferredModeLabel(payment.deferredMode),
    })
  }

  return {
    status: payment.status,
    statusLabel,
    completionRate,
    completionPercent,
    completionLabel: resolveScheduleCompletionLabel({
      completionPercent,
      paidTotal: payment.paidTotal,
      total: payment.total,
    }),
    checkoutChoice,
    checkoutChoiceLabel: resolveCheckoutChoiceLabel(checkoutChoice),
    deferredModeLabel: resolveDeferredModeLabel(payment.deferredMode),
    deferredDueDateISO,
    total: payment.total,
    paidTotal: payment.paidTotal,
    balance: payment.balance,
    onlinePaid: payment.onlinePaid,
    manualPaid: payment.manualPaid,
    entries,
  }
}

export function toRawReservationPayment(payment: ReservationPayment): RawReservationPayment {
  const method = normalizeMethod(payment.method)
  const manualEntries = normalizeManualPaymentEntries(payment.manual.entries)
  const stripe = normalizeStripeSnapshot(payment.stripe)

  return {
    total: Math.max(0, Math.round(payment.total)),
    deposit: Math.max(0, Math.round(payment.deposit)),
    balance: Math.max(0, Math.round(payment.balance)),
    status: payment.status === 'paid' ? 'paid' : 'pending',
    method,
    ...(manualEntries.length
      ? {
          manual: {
            entries: manualEntries.map((entry) => ({
              id: entry.id,
              amount: entry.amount,
              date: entry.date,
              method: entry.method,
              ...(entry.comment ? { comment: entry.comment } : {}),
            })),
          },
        }
      : {}),
    ...(stripe ? { stripe } : {}),
  }
}

function mapReservation(reservation: RawBookingReservation, listingId: string, pricePerNight: number, feesTotal: number, fallbackIndex = 0): Reservation {
  const safeNights = Math.max(1, toNonNegativeInt(reservation.nights, nightsBetween(reservation.start, reservation.end) || 1))
  const fallbackTotal = Math.max(0, Math.round(pricePerNight * safeNights + feesTotal))

  return {
    id: reservation.id || `${listingId}-${reservation.start}-${reservation.end}-${fallbackIndex}`,
    listingId,
    start: reservation.start,
    end: reservation.end,
    nights: safeNights,
    guestName: reservation.guestName?.trim() || `Voyageur ${fallbackIndex + 1}`,
    guestAvatar: reservation.guestAvatar,
    message: reservation.message ?? '',
    internalNote: reservation.internalNote?.trim() || undefined,
    guests: normalizeGuests(reservation.guests),
    payment: resolveReservationPayment(reservation.payment, fallbackTotal),
    contact: reservation.contact,
    createdAt: reservation.createdAt,
    messaging: reservation.messaging,
  }
}

function buildRawFallbackReservation({ listingId, start, end, index, fallbackTotal }: { listingId: string; start: string; end: string; index: number; fallbackTotal: number }): RawBookingReservation {
  const payment = toRawReservationPayment(resolveReservationPayment(undefined, fallbackTotal))

  return {
    id: `${listingId}-${start}-${end}-${index}`,
    start,
    end,
    nights: Math.max(1, nightsBetween(start, end)),
    guestName: `Voyageur ${index + 1}`,
    message: '',
    guests: {
      adults: 1,
      children: 0,
      infants: 0,
      pets: 0,
      pmr: 0,
    },
    payment,
  }
}

function mergeReservationsWithBookedDays({ listingId, reservations, bookings, pricePerNight, feesTotal }: { listingId: string; reservations: RawBookingReservation[]; bookings?: Partial<RawBookings> | null; pricePerNight: number; feesTotal: number }): RawBookingReservation[] {
  const bookedDays = getSynchronizedBookedDays(bookings)
  if (!bookedDays.length) return reservations

  const knownRanges = new Set(reservations.map((reservation) => `${reservation.start}__${reservation.end}`))
  const merged = [
    ...reservations,
  ]

  bookedDays.forEach((range, index) => {
    const key = `${range.start}__${range.end}`
    if (knownRanges.has(key)) return

    const nights = Math.max(1, nightsBetween(range.start, range.end))
    const fallbackTotal = Math.max(0, Math.round(pricePerNight * nights + feesTotal))
    merged.push(
      buildRawFallbackReservation({
        listingId,
        start: range.start,
        end: range.end,
        index,
        fallbackTotal,
      }),
    )
    knownRanges.add(key)
  })

  return normalizeReservations(merged)
}

function buildFallbackReservationsFromBookedDays(listingId: string, bookings?: Partial<RawBookings> | null): Reservation[] {
  const bookedDays = getSynchronizedBookedDays(bookings)
  const pricePerNight = Number(bookings?.price ?? 0) || 0
  const feesTotal = sumFees(bookings)

  return bookedDays.map((range, index) => {
    const nights = Math.max(1, nightsBetween(range.start, range.end))
    const fallbackTotal = Math.max(0, Math.round(pricePerNight * nights + feesTotal))
    return {
      id: `${listingId}-${range.start}-${range.end}-${index}`,
      listingId,
      start: range.start,
      end: range.end,
      nights,
      guestName: `Voyageur ${index + 1}`,
      message: '',
      guests: {
        adults: 1,
        children: 0,
        infants: 0,
        pets: 0,
        pmr: 0,
      },
      payment: resolveReservationPayment(undefined, fallbackTotal),
    }
  })
}

export function sortReservationsByDate(reservations: Reservation[]): Reservation[] {
  return [
    ...reservations,
  ].sort((a, b) => toDateMs(b.end) - toDateMs(a.end))
}

function compareByVisitEndDesc(a: Reservation, b: Reservation) {
  const byEnd = toDateMs(b.end) - toDateMs(a.end)
  if (byEnd !== 0) return byEnd

  const byStart = toDateMs(b.start) - toDateMs(a.start)
  if (byStart !== 0) return byStart

  return 0
}

function resolveReservationRecencyMs(reservation: Reservation): number {
  const createdAtMs = toDateTimeMs(reservation.createdAt)
  if (createdAtMs > 0) return createdAtMs

  const endMs = toDateMs(reservation.end)
  if (endMs > 0) return endMs

  return toDateMs(reservation.start)
}

function compareReservationRecency(a: Reservation, b: Reservation) {
  const byCreatedAt = resolveReservationRecencyMs(b) - resolveReservationRecencyMs(a)
  if (byCreatedAt !== 0) return byCreatedAt
  return compareByVisitEndDesc(a, b)
}

export function buildReservationsForListing({ listing, bookings }: { listing: UserListingCard; bookings?: Partial<RawBookings> | null }): Reservation[] {
  const normalized = normalizeReservations(bookings?.reservations)
  const pricePerNight = Number(bookings?.price ?? listing.pricePerNight ?? 0) || 0
  const feesTotal = sumFees(bookings)
  const merged = mergeReservationsWithBookedDays({
    listingId: listing.listingId,
    reservations: normalized,
    bookings,
    pricePerNight,
    feesTotal,
  })

  const reservations = merged.length ? merged.map((reservation, index) => mapReservation(reservation, listing.listingId, pricePerNight, feesTotal, index)) : buildFallbackReservationsFromBookedDays(listing.listingId, bookings)

  return sortReservationsByDate(reservations)
}

export function findLatestReservation(reservationsByListing: Record<string, Reservation[]>): {
  listingId: string
  reservation: Reservation
} | null {
  let latest: { listingId: string; reservation: Reservation } | null = null

  for (const [
    listingId,
    reservations,
  ] of Object.entries(reservationsByListing)) {
    for (const reservation of reservations) {
      if (!latest) {
        latest = { listingId, reservation }
        continue
      }

      if (compareReservationRecency(reservation, latest.reservation) < 0) {
        latest = { listingId, reservation }
      }
    }
  }

  return latest
}

export function findLatestReservationForListing(reservations: Reservation[]): Reservation | null {
  if (!reservations.length) return null

  return reservations.reduce<Reservation | null>((latest, current) => {
    if (!latest) return current
    return compareReservationRecency(current, latest) < 0 ? current : latest
  }, null)
}

export function findLatestVisitForListing(reservations: Reservation[], referenceDate = new Date()): LatestVisitForListing | null {
  if (!reservations.length) return null

  const referenceMs = toUtcTodayMs(referenceDate)
  let visitInProgress: Reservation | null = null
  let latestPastVisit: Reservation | null = null

  for (const reservation of reservations) {
    const startMs = toDateMs(reservation.start)
    const endMs = toDateMs(reservation.end)
    if (!startMs || !endMs || endMs < startMs) continue

    if (startMs <= referenceMs && referenceMs <= endMs) {
      if (!visitInProgress || compareByVisitEndDesc(reservation, visitInProgress) < 0) {
        visitInProgress = reservation
      }
      continue
    }

    if (endMs < referenceMs) {
      if (!latestPastVisit || compareByVisitEndDesc(reservation, latestPastVisit) < 0) {
        latestPastVisit = reservation
      }
    }
  }

  if (visitInProgress) {
    return {
      reservation: visitInProgress,
      isInProgress: true,
    }
  }

  if (latestPastVisit) {
    return {
      reservation: latestPastVisit,
      isInProgress: false,
    }
  }

  return null
}

export function findClosestReservationForListing(reservations: Reservation[], referenceDate = new Date()): Reservation | null {
  if (!reservations.length) return null
  const referenceMs = toUtcTodayMs(referenceDate)

  return reservations.reduce<Reservation | null>((closest, current) => {
    if (!closest) return current
    return compareReservationRelevance(current, closest, referenceMs) < 0 ? current : closest
  }, null)
}

export function findClosestReservation(
  reservationsByListing: Record<string, Reservation[]>,
  referenceDate = new Date(),
): {
  listingId: string
  reservation: Reservation
} | null {
  const referenceMs = toUtcTodayMs(referenceDate)
  let closest: { listingId: string; reservation: Reservation } | null = null

  for (const [
    listingId,
    reservations,
  ] of Object.entries(reservationsByListing)) {
    for (const reservation of reservations) {
      if (!closest) {
        closest = { listingId, reservation }
        continue
      }

      if (compareReservationRelevance(reservation, closest.reservation, referenceMs) < 0) {
        closest = { listingId, reservation }
      }
    }
  }

  return closest
}
