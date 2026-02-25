// File: src/domain/user/stripeConnect.ts

import ownerUserJSON from '@/content/fr/user/user.json'

export type StripeConnectOnboardingStatus = 'not_started' | 'pending' | 'completed' | 'restricted'

export type OwnerStripeConnectProfile = {
  accountId: string | null
  onboardingStatus: StripeConnectOnboardingStatus
  chargesEnabled: boolean
  payoutsEnabled: boolean
  defaultCurrency: string
  transferSchedule: string
}

function parseString(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed || fallback
}

function parseBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  return fallback
}

function parseOnboardingStatus(value: unknown): StripeConnectOnboardingStatus {
  if (value === 'pending') return 'pending'
  if (value === 'completed') return 'completed'
  if (value === 'restricted') return 'restricted'
  return 'not_started'
}

export function getOwnerStripeConnectProfile(): OwnerStripeConnectProfile {
  const connect = ownerUserJSON?.billing?.stripeConnect ?? {}
  const legacyAccountId = parseString(ownerUserJSON?.billing?.stripeConnectAccountId, '')
  const accountId = parseString(connect.accountId, legacyAccountId) || null

  return {
    accountId,
    onboardingStatus: parseOnboardingStatus(connect.onboardingStatus),
    chargesEnabled: parseBoolean(connect.chargesEnabled, false),
    payoutsEnabled: parseBoolean(connect.payoutsEnabled, false),
    defaultCurrency: parseString(connect.defaultCurrency, 'eur').toLowerCase(),
    transferSchedule: parseString(connect.transferSchedule, 'manual'),
  }
}

export function getOwnerStripeConnectAccountId(): string | null {
  return getOwnerStripeConnectProfile().accountId
}
