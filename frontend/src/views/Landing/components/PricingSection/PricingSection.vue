<!-- File: src/views/Landing/components/PricingSection/PricingSection.vue -->

<script setup lang="ts">
import { SignUpButton, SignedIn, SignedOut } from '@clerk/vue'
import { useRouter } from 'vue-router'

import type { SubscriptionPlanCode } from '@/domain/api/stripeSubscriptions'
import { MARKETING_PRICING_PLANS } from '@/domain/payments/pricingPlanCatalog'

const router = useRouter()

const plans = MARKETING_PRICING_PLANS

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
  <section
    id="pricing-section"
    class="pricing-unified landing-pricing"
  >
    <div class="pricing-shell">
      <div class="pricing-title">
        <p
          data-sr
          data-sr-y="-20"
          class="pricing-eyebrow"
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
          class="pricing-subtitle"
        >
          Choisissez le niveau de volume, de personnalisation et d’automatisation adapté à votre activité.
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
              v-if="plan.highlight"
              class="plan-highlight"
            >
              {{ plan.highlight }}
            </p>
            <h3>{{ plan.name }}</h3>
            <p class="price">{{ plan.displayPrice }}</p>
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
