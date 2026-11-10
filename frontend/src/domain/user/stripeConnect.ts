// File: src/domain/user/stripeConnect.ts

// `verifying` : l'hôte a tout fourni, Stripe vérifie ses pièces. Rien à faire de son côté.
export type StripeConnectOnboardingStatus = 'not_started' | 'pending' | 'verifying' | 'completed' | 'restricted'

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
  if (value === 'verifying') return 'verifying'
  if (value === 'restricted') return 'restricted'
  return 'not_started'
}

export function getOwnerStripeConnectProfile(): OwnerStripeConnectProfile {
  return {
    accountId: null,
    onboardingStatus: 'not_started',
    chargesEnabled: false,
    payoutsEnabled: false,
    defaultCurrency: 'eur',
    transferSchedule: 'manual',
  }
}

export function getOwnerStripeConnectAccountId(): string | null {
  return getOwnerStripeConnectProfile().accountId
}
