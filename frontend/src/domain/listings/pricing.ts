// File: src/domain/listings/pricing.ts

import { nightsBetween, toUtcDay } from '@/domain/listings/bookings'
import type { RawPricingSettings } from '@/domain/listings/types'

const DAY_MS = 24 * 60 * 60 * 1000

export type WeekendPricingConfig = {
  enabled: boolean
  price: number
}

export type DurationDiscountTier = {
  minNights: number
  percent: number
}

export type NightlyPriceBreakdown = {
  nights: number
  weekdayNights: number
  weekendNights: number
  weekdayPrice: number
  weekendPrice: number
  weekdayTotal: number
  weekendTotal: number
  nightlySubtotal: number
  durationDiscountPercent: number
  durationDiscountTotal: number
  appliedDurationDiscountTier: DurationDiscountTier | null
  nightlyTotal: number
  averageNightlyPrice: number
}

function clampInteger(value: unknown, min: number, max: number, fallback = min): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(parsed)))
}

function toNonNegativeAmount(value: unknown, fallback = 0): number {
  const candidate = Number(value)
  if (!Number.isFinite(candidate) || candidate < 0) return fallback
  return candidate
}

function normalizeDurationDiscountTier(input: unknown): DurationDiscountTier | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null

  const raw = input as Record<string, unknown>
  const minNights = clampInteger(raw.minNights, 1, 365, 1)
  const percent = clampInteger(raw.percent, 0, 100, 0)
  if (percent <= 0) return null

  return {
    minNights,
    percent,
  }
}

export function normalizeDurationDiscountTiers(input: unknown): DurationDiscountTier[] {
  if (!Array.isArray(input)) return []

  const byThreshold = new Map<number, DurationDiscountTier>()

  input.forEach((entry) => {
    const normalized = normalizeDurationDiscountTier(entry)
    if (!normalized) return
    const previous = byThreshold.get(normalized.minNights)
    if (!previous || normalized.percent > previous.percent) {
      byThreshold.set(normalized.minNights, normalized)
    }
  })

  return Array.from(byThreshold.values()).sort((a, b) => a.minNights - b.minNights)
}

function resolveAppliedDurationDiscountTier(nights: number, tiers: DurationDiscountTier[]): DurationDiscountTier | null {
  if (!tiers.length || nights <= 0) return null

  let applied: DurationDiscountTier | null = null
  tiers.forEach((tier) => {
    if (nights >= tier.minNights) {
      applied = tier
    }
  })

  return applied
}

export function resolveWeekendPricing(pricing?: Partial<RawPricingSettings> | null, fallbackPrice = 0): WeekendPricingConfig | null {
  const weekend = pricing?.weekend
  if (!weekend || typeof weekend !== 'object') return null
  if (!weekend.enabled) return null

  return {
    enabled: true,
    price: toNonNegativeAmount(weekend.price, toNonNegativeAmount(fallbackPrice)),
  }
}

function countWeekendNights(startISO: string, endISO: string): number {
  const startUtc = toUtcDay(startISO)
  const endUtc = toUtcDay(endISO)
  if (startUtc === null || endUtc === null || endUtc <= startUtc) return 0

  let total = 0
  for (let current = startUtc; current < endUtc; current += DAY_MS) {
    const weekday = new Date(current).getUTCDay()
    if (weekday === 5 || weekday === 6) {
      total += 1
    }
  }

  return total
}

export function computeNightlyPriceBreakdown({
  startISO,
  endISO,
  basePrice,
  weekendPricing,
  durationDiscountTiers,
}: {
  startISO: string
  endISO: string
  basePrice: number
  weekendPricing?: WeekendPricingConfig | null
  durationDiscountTiers?: DurationDiscountTier[] | null
}): NightlyPriceBreakdown {
  const nights = Math.max(0, nightsBetween(startISO, endISO))
  const weekdayPrice = toNonNegativeAmount(basePrice)
  const weekendPrice = weekendPricing?.enabled ? toNonNegativeAmount(weekendPricing.price, weekdayPrice) : weekdayPrice
  const weekendNights = weekendPricing?.enabled ? Math.min(nights, countWeekendNights(startISO, endISO)) : 0
  const weekdayNights = Math.max(0, nights - weekendNights)
  const weekdayTotal = weekdayNights * weekdayPrice
  const weekendTotal = weekendNights * weekendPrice
  const nightlySubtotal = weekdayTotal + weekendTotal
  const normalizedTiers = normalizeDurationDiscountTiers(durationDiscountTiers)
  const appliedDurationDiscountTier = resolveAppliedDurationDiscountTier(nights, normalizedTiers)
  const durationDiscountPercent = appliedDurationDiscountTier?.percent ?? 0
  const durationDiscountTotal = Math.round((nightlySubtotal * durationDiscountPercent) / 100)
  const nightlyTotal = Math.max(0, nightlySubtotal - durationDiscountTotal)
  const averageNightlyPrice = nights > 0 ? nightlyTotal / nights : weekdayPrice

  return {
    nights,
    weekdayNights,
    weekendNights,
    weekdayPrice,
    weekendPrice,
    weekdayTotal,
    weekendTotal,
    nightlySubtotal,
    durationDiscountPercent,
    durationDiscountTotal,
    appliedDurationDiscountTier,
    nightlyTotal,
    averageNightlyPrice,
  }
}
