// File: src/domain/payments/stripeClient.ts

import { loadStripe, type Stripe } from '@stripe/stripe-js'

let stripePromise: Promise<Stripe | null> | null = null
const TRUTHY_ENV_VALUES = new Set(['1', 'true', 'yes', 'on'])

function isTruthyEnvFlag(value: unknown): boolean {
  if (typeof value !== 'string') return false
  return TRUTHY_ENV_VALUES.has(value.trim().toLowerCase())
}

export function getStripePublishableKey(): string {
  return (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '').trim()
}

export function isStripeCheckoutOfflineModeEnabled(): boolean {
  return isTruthyEnvFlag(import.meta.env.VITE_STRIPE_CHECKOUT_OFFLINE_MODE ?? '')
}

export function getStripePaymentReturnUrl(): string {
  const configured = (import.meta.env.VITE_STRIPE_PAYMENT_RETURN_URL ?? '').trim()
  if (configured) return configured
  if (typeof window === 'undefined') return ''
  return window.location.href
}

export function loadStripeClient(): Promise<Stripe | null> {
  if (stripePromise) return stripePromise

  const key = getStripePublishableKey()
  if (!key) {
    stripePromise = Promise.resolve(null)
    return stripePromise
  }

  stripePromise = loadStripe(key)
  return stripePromise
}
