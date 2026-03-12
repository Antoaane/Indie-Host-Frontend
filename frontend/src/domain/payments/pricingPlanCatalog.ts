// File: src/domain/payments/pricingPlanCatalog.ts

import type { SubscriptionPlanCode } from '@/domain/api/stripeSubscriptions'

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
  helper: string
  tone: PricingPlanTone
  highlight?: string
}

const PLAN_ORDER: SubscriptionPlanCode[] = ['indiehost', 'superhost', 'megahost']

const PLAN_CATALOG: Record<SubscriptionPlanCode, MarketingPricingPlan> = {
  indiehost: {
    id: 'indiehost',
    code: 'indiehost',
    tier: 'Plan 1',
    name: 'IndieHost',
    displayPrice: '16 € / mois TTC',
    summary: "Pour les hôtes avec 1 logement listé comprenant au maximum 2 annonces.",
    includes: [
      '1 page de réservation personnalisée',
      'Paiement en ligne sécurisé (Stripe : CB, SEPA, Apple Pay)',
      'Facturation automatique pour les paiements en ligne (résumé mensuel + export CSV)',
      'Calendrier connecté iCAL + gestion des disponibilités et tarifs',
      'Messagerie fluide hôte-voyageur sans compte',
      'Sous-domaine inclus',
      "Jusqu'à 8 séjours par mois",
    ],
    positioning: '100 % opérationnel dès le jour 1 pour un particulier. Zéro commission.',
    cta: 'Choisir IndieHost',
    helper: 'Activation immédiate avec parcours Stripe sécurisé.',
    tone: 'indigo',
  },
  superhost: {
    id: 'superhost',
    code: 'superhost',
    tier: 'Plan 2',
    name: 'SuperHost',
    displayPrice: '39 € / mois TTC',
    summary: 'Pour les hôtes semi-pros qui veulent gagner en autonomie et fidéliser.',
    includes: [
      'Tout le plan IndieHost',
      "Jusqu'à 3 pages de réservation personnalisées",
      'Connexion avec les channel managers (PMS)',
      "Ajout manuel d'une nouvelle réservation dans le calendrier centralisé",
      'Annonces avec thèmes personnalisés',
      "Livret d'accueil physique personnalisable",
      'Conditions de paiement étendues',
      'Réservations illimitées',
    ],
    options: [
      'URL personnalisée : + 5 € / mois',
      'Google Travel intégration : + 12 € / mois',
    ],
    positioning: 'Le bon équilibre pour professionnaliser son activité sans perdre en simplicité.',
    cta: "S'abonner à SuperHost",
    helper: 'Paiement sécurisé et activation guidée via Stripe.',
    tone: 'gold',
    highlight: 'Le plus choisi',
  },
  megahost: {
    id: 'megahost',
    code: 'megahost',
    tier: 'Plan 3',
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
    cta: 'Souscrire à MegaHost',
    helper: 'Activation directe avec retour sécurisé dans IndieHost.',
    tone: 'red',
  },
}

export const MARKETING_PRICING_PLANS: MarketingPricingPlan[] = PLAN_ORDER.map((planCode) => PLAN_CATALOG[planCode])

export function getMarketingPricingPlan(planCode: SubscriptionPlanCode): MarketingPricingPlan {
  return PLAN_CATALOG[planCode]
}
