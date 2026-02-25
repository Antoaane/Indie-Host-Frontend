// File: src/domain/listings/pricing.ts

import { nightsBetween, toUtcDay } from '@/domain/listings/bookings'
import type { RawPricingSettings } from '@/domain/listings/types'

const DAY_MS = 24 * 60 * 60 * 1000

export type WeekendPricingConfig = {
  enabled: boolean
  price: number
}

export type NightlyPriceBreakdown = {
  nights: number
  weekdayNights: number
  weekendNights: number
  weekdayPrice: number
  weekendPrice: number
  weekdayTotal: number
  weekendTotal: number
  nightlyTotal: number
  averageNightlyPrice: number
}

function toNonNegativeAmount(value: unknown, fallback = 0): number {
  const candidate = Number(value)
  if (!Number.isFinite(candidate) || candidate < 0) return fallback
  return candidate
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
}: {
  startISO: string
  endISO: string
  basePrice: number
  weekendPricing?: WeekendPricingConfig | null
}): NightlyPriceBreakdown {
  const nights = Math.max(0, nightsBetween(startISO, endISO))
  const weekdayPrice = toNonNegativeAmount(basePrice)
  const weekendPrice = weekendPricing?.enabled ? toNonNegativeAmount(weekendPricing.price, weekdayPrice) : weekdayPrice
  const weekendNights = weekendPricing?.enabled ? Math.min(nights, countWeekendNights(startISO, endISO)) : 0
  const weekdayNights = Math.max(0, nights - weekendNights)
  const weekdayTotal = weekdayNights * weekdayPrice
  const weekendTotal = weekendNights * weekendPrice
  const nightlyTotal = weekdayTotal + weekendTotal
  const averageNightlyPrice = nights > 0 ? nightlyTotal / nights : weekdayPrice

  return {
    nights,
    weekdayNights,
    weekendNights,
    weekdayPrice,
    weekendPrice,
    weekdayTotal,
    weekendTotal,
    nightlyTotal,
    averageNightlyPrice,
  }
}
