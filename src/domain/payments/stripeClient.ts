// File: src/domain/payments/stripeClient.ts

import { loadStripe, type Stripe } from '@stripe/stripe-js'

let stripePromise: Promise<Stripe | null> | null = null

export function getStripePublishableKey(): string {
  return (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '').trim()
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
