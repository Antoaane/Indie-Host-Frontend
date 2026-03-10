<!-- File: src/views/Landing/components/PricingSection/PricingSection.vue -->

<script setup lang="ts">
import { SignUpButton, SignedIn, SignedOut } from '@clerk/vue'
import { useRouter } from 'vue-router'

import type { SubscriptionPlanCode } from '@/domain/api/stripeSubscriptions'

type PricingPlan = {
  id: string
  code: SubscriptionPlanCode
  tier: string
  name: string
  price: string
  summary: string
  includes: string[]
  options?: string[]
  positioning: string
  cta: string
  helper: string
  tone: 'indigo' | 'gold' | 'red'
}

const router = useRouter()

const plans: PricingPlan[] = [
  {
    id: 'indiehost-free',
    code: 'indiehost',
    tier: 'Plan 1',
    name: 'IndieHost FREE',
    price: 'Gratuit',
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
    positioning: '100 % opérationnel dès le jour 1 pour un particulier. Zéro commission, gratuit.',
    cta: 'Activer gratuitement',
    helper: 'Aucune carte bancaire requise.',
    tone: 'indigo',
  },
  {
    id: 'superhost',
    code: 'superhost',
    tier: 'Plan 2',
    name: 'SuperHost',
    price: '39 EUR / mois TTC',
    summary: "Pour les hôtes semi-pros qui veulent gagner en autonomie et fidéliser.",
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
      'URL personnalisée : + 5 EUR / mois',
      'Google Travel intégration : + 12 EUR / mois',
    ],
    positioning: 'Le bon équilibre pour professionnaliser son activité sans perdre en simplicité.',
    cta: "S'abonner à SuperHost",
    helper: 'Paiement sécurisé et activation guidée via Stripe.',
    tone: 'gold',
  },
  {
    id: 'megahost',
    code: 'megahost',
    tier: 'Plan 3',
    name: 'MegaHost',
    price: 'A partir de 199 EUR / mois TTC',
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
    helper: 'Parcours d’abonnement direct, avec retour sécurisé dans IndieHost.',
    tone: 'red',
  },
]

function buildPricingReturnUrl(planCode: SubscriptionPlanCode): string {
  const path = `/pricing?plan=${encodeURIComponent(planCode)}&autostart=1`
  if (typeof window === 'undefined') return path
  return new URL(path, window.location.origin).toString()
}

function goToPricing(planCode: SubscriptionPlanCode) {
  void router.push({ path: '/pricing', query: { plan: planCode, autostart: '1' } })
}
</script>

<template>
  <section id="pricing-section">
    <div class="wrapper">
      <div class="title">
        <p
          data-sr
          data-sr-y="-20"
          class="eyebrow"
        >
          Tarifs
        </p>
        <h2
          data-sr
          data-sr-y="-30"
        >
          Une grille simple pour <strong>lancer</strong>, <strong>faire grandir</strong> puis <strong>industrialiser</strong> vos réservations directes.
        </h2>
        <p
          data-sr
          data-sr-y="30"
          class="subtitle"
        >
          Commencez gratuitement, puis débloquez plus de volume, de personnalisation et d'automatisation quand votre activité le demande.
        </p>
      </div>

      <div class="plans">
        <article
          v-for="(plan, index) in plans"
          :id="plan.id"
          :key="plan.id"
          class="plan"
          :class="[`is-${plan.tone}`, { 'is-featured': plan.tone === 'gold' }]"
          data-sr
          data-sr-y="50"
          :data-sr-delay="index * 0.15"
        >
          <div class="plan-topline"></div>

          <div class="plan-head">
            <div class="plan-badge">
              <span class="plan-tier">{{ plan.tier }}</span>
            </div>
            <p
              v-if="plan.tone === 'gold'"
              class="plan-highlight"
            >
              Le plus choisi
            </p>
            <h3>{{ plan.name }}</h3>
            <p class="price">{{ plan.price }}</p>
            <p class="summary">{{ plan.summary }}</p>
          </div>

          <div class="plan-body">
            <div class="block">
              <p class="block-label">Inclus</p>
              <ul>
                <li
                  v-for="item in plan.includes"
                  :key="item"
                >
                  {{ item }}
                </li>
              </ul>
            </div>

            <div
              v-if="plan.options?.length"
              class="block block-options"
            >
              <p class="block-label">Options</p>
              <ul>
                <li
                  v-for="option in plan.options"
                  :key="option"
                >
                  {{ option }}
                </li>
              </ul>
            </div>

            <p class="positioning">{{ plan.positioning }}</p>

            <div class="plan-actions">
              <SignedIn>
                <button
                  type="button"
                  class="plan-cta"
                  @click="goToPricing(plan.code)"
                >
                  {{ plan.cta }}
                </button>
              </SignedIn>

              <SignedOut>
                <SignUpButton
                  mode="redirect"
                  :force-redirect-url="buildPricingReturnUrl(plan.code)"
                >
                  <button
                    type="button"
                    class="plan-cta"
                  >
                    {{ plan.cta }}
                  </button>
                </SignUpButton>
              </SignedOut>

              <p class="plan-helper">
                {{ plan.helper }}
              </p>
            </div>
          </div>
        </article>
      </div>

      <p class="account-link">
        Déjà client ? <RouterLink to="/sign-in?redirect_url=%2Fpricing">Se connecter</RouterLink>
      </p>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Landing/components/PricingSection/pricing-section.scss';
</style>
