// File: src/domain/payments/stripeClient.ts

// Variante « pure » : le script Stripe (et ses cookies anti-fraude) n'est injecté qu'à l'appel de
// loadStripe(), c'est-à-dire à l'étape de paiement, et non dès qu'une page importe ce module.
import { loadStripe } from '@stripe/stripe-js/pure'
import type { Stripe } from '@stripe/stripe-js'

// Une instance par compte : les paiements directs vivent sur le compte Stripe de l'hôte, et
// Stripe.js doit être initialisé avec ce compte pour retrouver le PaymentIntent.
const stripePromises = new Map<string, Promise<Stripe | null>>()
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

/**
 * @param stripeAccount compte Stripe de l'hôte qui encaisse (paiement direct). Sans compte,
 * l'instance vise le compte plateforme d'IndieHost.
 */
export function loadStripeClient(stripeAccount?: string | null): Promise<Stripe | null> {
  const account = (stripeAccount ?? '').trim()
  const cached = stripePromises.get(account)
  if (cached) return cached

  const key = getStripePublishableKey()
  const promise = key
    ? loadStripe(key, account ? { stripeAccount: account } : undefined)
    : Promise.resolve(null)
  stripePromises.set(account, promise)
  return promise
}
