// File: src/domain/user/subscription.ts

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
  return DEFAULT_MAX_ACTIVE_LISTINGS
}
