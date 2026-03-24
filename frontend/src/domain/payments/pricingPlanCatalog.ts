// File: src/domain/payments/pricingPlanCatalog.ts

import type { StripeSubscriptionPlan, SubscriptionPlanCode } from '@/domain/api/stripeSubscriptions'

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

const PLAN_ORDER: SubscriptionPlanCode[] = ['indiehost', 'superhost', 'megahost']

const PLAN_CATALOG: Record<SubscriptionPlanCode, MarketingPricingPlan> = {
  indiehost: {
    id: 'indiehost',
    code: 'indiehost',
    tier: 'Offre 1',
    name: 'IndieHost',
    displayPrice: '29 € / mois TTC',
    summary: "L'offre essentielle pour gérer 1 logement en ligne et démarrer rapidement.",
    includes: [
      '1 logement en ligne',
      'Synchronisation des réservations',
      'Messagerie intégrée',
    ],
    positioning: 'Parfait pour poser des bases solides avec une expérience fluide dès le premier logement.',
    cta: 'Essayer gratuitement',
    secondaryCta: "S'abonner",
    helper: "Essai gratuit inclus avant activation de l'abonnement à 29 € / mois.",
    tone: 'indigo',
  },
  superhost: {
    id: 'superhost',
    code: 'superhost',
    tier: 'Offre 2',
    name: 'SuperHost',
    displayPrice: '39 € / mois TTC',
    summary: "Pensé pour franchir un cap avec jusqu'à 3 logements gérés depuis une seule interface.",
    includes: [
      '3 logements enregistrés',
      'Page avec URL personnalisée',
      'Ajout manuel de nouvelles réservations',
      'Synchronisation des réservations',
      'Messagerie intégrée',
      'Paiements et acomptes sécurisés',
    ],
    positioning: 'Un palier naturel pour augmenter votre capacité et vos revenus sans complexifier votre quotidien.',
    cta: 'Essayer gratuitement',
    secondaryCta: "S'abonner",
    helper: "Essai gratuit inclus puis abonnement à 39 € / mois avec activation guidée via Stripe.",
    tone: 'gold',
    highlight: 'La plus choisie',
  },
  megahost: {
    id: 'megahost',
    code: 'megahost',
    tier: 'Offre 3',
    name: 'MegaHost',
    displayPrice: '99 € / mois TTC',
    summary: "Pour les pros de l'hébergement : gîte, hôtel, conciergerie ou portefeuille multi-biens.",
    includes: [
      'Tout le plan SuperHost',
      '15 pages de réservation personnalisées',
      'URL personnalisée incluse',
      'Google Travel intégration incluse',
      "E-commerce intégré au livret d'accueil",
      'Campagnes marketing email (promo, retour, anniversaire...)',
      "Statistiques avancées (origine du trafic, CA/logement, taux d'occupation)",
    ],
    positioning: 'Pensé pour les structures qui veulent centraliser, scaler et piloter finement leur acquisition directe.',
    cta: 'Bientôt disponible',
    helper: 'Offre en cours de validation produit pour les professionnels de l’hôtellerie.',
    tone: 'red',
    available: false,
    unavailableReason: 'Momentanément indisponible',
    watermark: 'Momentanément indisponible',
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
  const amount = stripePlan.monthlyPriceMinor / 100
  if (!Number.isFinite(amount) || amount < 0) return null

  const currency = normalizeCurrencyCode(stripePlan.currency)
  const formattedAmount = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount)

  return `${formattedAmount} ${resolveBillingIntervalLabel(stripePlan.billingInterval)}`
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
