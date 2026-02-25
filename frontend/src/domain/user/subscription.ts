// File: src/domain/user/subscription.ts

import ownerUserJSON from '@/content/fr/user/user.json'

const DEFAULT_MAX_ACTIVE_LISTINGS = 6

function asPositiveInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const next = Math.trunc(value)
    return next > 0 ? next : null
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return null
    const next = Math.trunc(parsed)
    return next > 0 ? next : null
  }

  return null
}

export function getUserMaxActiveListings(): number {
  const fromSubscription = asPositiveInteger(ownerUserJSON?.billing?.subscription?.limits?.maxActiveListings)
  if (fromSubscription) return fromSubscription

  const fromPortfolio = asPositiveInteger(ownerUserJSON?.hosting?.portfolio?.listingCount)
  if (fromPortfolio) return fromPortfolio

  return DEFAULT_MAX_ACTIVE_LISTINGS
}
