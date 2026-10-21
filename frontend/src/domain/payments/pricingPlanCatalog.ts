// File: src/domain/payments/pricingPlanCatalog.ts

import type { StripeExtraListingOffer, StripeSubscriptionPlan, SubscriptionPlanCode } from '@/domain/api/stripeSubscriptions'

export type PricingPlanTone = 'indigo' | 'gold' | 'red'

export type MarketingPricingPlan = {
  id: string
  code: SubscriptionPlanCode
  tier: string
  name: string
  displayPrice: string
  summary: string
  includes: string[]
  options?: string[]
  positioning: string
  cta: string
  secondaryCta?: string
  helper: string
  tone: PricingPlanTone
  highlight?: string
  available?: boolean
  unavailableReason?: string | null
  watermark?: string | null
}

export type PricingPlanPresentation = {
  name: string
  summary: string
  displayPrice: string
}

type StripePlanPresentationSource = Pick<
StripeSubscriptionPlan,
'name' | 'description' | 'monthlyPriceMinor' | 'currency' | 'billingInterval'
>

const PLAN_ORDER: SubscriptionPlanCode[] = ['indiehost', 'superhost']

/** Logement au-delà de ceux inclus dans le plan : valeur de secours, le prix Stripe fait foi. */
export const EXTRA_LISTING_MARKETING = {
  name: 'Logement supplémentaire',
  displayPrice: '12 € / mois TTC par logement',
  summary: 'Au-delà des logements inclus, chaque logement en ligne supplémentaire est facturé 12 € / mois TTC, ajustable à tout moment depuis votre tableau de bord.',
  option: 'Logement supplémentaire : 12 € / mois TTC chacun',
}

const PLAN_CATALOG: Record<SubscriptionPlanCode, MarketingPricingPlan> = {
  indiehost: {
    id: 'indiehost',
    code: 'indiehost',
    tier: 'Offre 1',
    name: 'IndieHost',
    displayPrice: '19 € / mois TTC',
    summary: "L'essentiel pour mettre en ligne jusqu'à 2 logements et encaisser vos réservations sans commission.",
    includes: [
      '2 logements en ligne',
      'Page de réservation directe avec paiement Stripe',
      'Votre propre nom de domaine (ex. www.gite-belair.fr)',
      'Calendrier synchronisé Airbnb / Booking (iCal)',
      'Messagerie voyageurs intégrée',
      "Livret d'accueil numérique",
      'Sous-domaine IndieHost gratuit',
    ],
    options: [EXTRA_LISTING_MARKETING.option],
    positioning: "Pensé pour l'hôte qui gère un ou deux logements et veut reprendre la main sur ses réservations.",
    cta: 'Essayer gratuitement',
    secondaryCta: "S'abonner",
    helper: "30 jours d'essai gratuit, puis 19 € / mois TTC. Sans engagement.",
    tone: 'indigo',
  },
  superhost: {
    id: 'superhost',
    code: 'superhost',
    tier: 'Offre 2',
    name: 'SuperHost',
    displayPrice: '49 € / mois TTC',
    summary: "Pour les hôtes multi-logements : jusqu'à 6 logements en ligne et des outils de gestion avancés.",
    includes: [
      '6 logements en ligne',
      "Tout IndieHost inclus",
      'Votre propre nom de domaine (ex. www.gite-belair.fr)',
      'Ajout manuel de réservations',
      'Paiements et acomptes sécurisés',
      'Synchronisation des calendriers externes',
    ],
    options: [EXTRA_LISTING_MARKETING.option],
    positioning: "Plus avantageux qu'IndieHost dès 5 logements.",
    cta: 'Essayer gratuitement',
    secondaryCta: "S'abonner",
    helper: "30 jours d'essai gratuit, puis 49 € / mois TTC. Sans engagement.",
    tone: 'gold',
    highlight: 'La plus choisie',
  },
}

export const MARKETING_PRICING_PLANS: MarketingPricingPlan[] = PLAN_ORDER.map((planCode) => PLAN_CATALOG[planCode])

export function getMarketingPricingPlan(planCode: SubscriptionPlanCode): MarketingPricingPlan {
  return PLAN_CATALOG[planCode]
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeCurrencyCode(value: unknown): string {
  const normalized = toNonEmptyString(value)?.toUpperCase()
  if (normalized && /^[A-Z]{3}$/.test(normalized)) return normalized
  return 'EUR'
}

function formatMinorAmount(amountMinor: number, currency: unknown): string {
  const amount = amountMinor / 100
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: normalizeCurrencyCode(currency),
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount)
}

function resolveBillingIntervalLabel(value: unknown): string {
  const normalized = toNonEmptyString(value)?.toLowerCase() ?? ''
  if (normalized === 'month' || normalized === 'monthly' || normalized === 'mois' || normalized === 'mensuel') {
    return '/ mois TTC'
  }
  if (
    normalized === 'year'
    || normalized === 'yearly'
    || normalized === 'annual'
    || normalized === 'annually'
    || normalized === 'an'
    || normalized === 'annuel'
  ) {
    return '/ an TTC'
  }
  return '/ période TTC'
}

function resolveDynamicDisplayPrice(stripePlan?: StripePlanPresentationSource | null): string | null {
  if (!stripePlan) return null
  if (typeof stripePlan.monthlyPriceMinor !== 'number' || !Number.isFinite(stripePlan.monthlyPriceMinor)) return null
  if (stripePlan.monthlyPriceMinor < 0) return null

  return `${formatMinorAmount(stripePlan.monthlyPriceMinor, stripePlan.currency)} ${resolveBillingIntervalLabel(stripePlan.billingInterval)}`
}

export function resolvePricingPlanPresentation(
  marketingPlan: MarketingPricingPlan,
  stripePlan?: StripePlanPresentationSource | null,
): PricingPlanPresentation {
  return {
    name: toNonEmptyString(stripePlan?.name) ?? marketingPlan.name,
    summary: toNonEmptyString(stripePlan?.description) ?? marketingPlan.summary,
    displayPrice: resolveDynamicDisplayPrice(stripePlan) ?? marketingPlan.displayPrice,
  }
}

/** Prix d'un logement supplémentaire, ex. « 12 € », d'après l'offre Stripe ou la valeur de secours. */
export function formatExtraListingPrice(offer?: StripeExtraListingOffer | null): string {
  if (offer && typeof offer.monthlyPriceMinor === 'number' && Number.isFinite(offer.monthlyPriceMinor) && offer.monthlyPriceMinor >= 0) {
    return formatMinorAmount(offer.monthlyPriceMinor, offer.currency)
  }
  return '12 €'
}
