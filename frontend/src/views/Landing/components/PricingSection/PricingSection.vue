<!-- File: src/views/Landing/components/PricingSection/PricingSection.vue -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { SignUpButton, SignedIn, SignedOut } from '@clerk/vue'
import { useRouter } from 'vue-router'

import { fetchStripeSubscriptionPlans, type StripeSubscriptionPlan, type SubscriptionPlanCode } from '@/domain/api/stripeSubscriptions'
import { MARKETING_PRICING_PLANS, resolvePricingPlanPresentation } from '@/domain/payments/pricingPlanCatalog'
import type { PricingSectionContent } from '@/views/Landing/types/content'

defineProps<{
  content: PricingSectionContent
}>()

/** Un seul plan déplié à la fois : évite les bugs de réactivité et garde l’UI lisible. */
const expandedPlanId = ref<string | null>(null)

const PREVIEW_INCLUDES_COUNT = 3

function togglePlan(planId: string) {
  expandedPlanId.value = expandedPlanId.value === planId ? null : planId
}

function isExpanded(planId: string): boolean {
  return expandedPlanId.value === planId
}

type PricingPlan = {
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
  tone: 'indigo' | 'gold' | 'red'
  highlight?: string
  available: boolean
  unavailableReason: string | null
}

const router = useRouter()

const plansFromApi = ref<StripeSubscriptionPlan[]>([])

const plansFromApiByCode = computed(() => new Map(plansFromApi.value.map((plan) => [plan.code, plan])))

const plans = computed<PricingPlan[]>(() => {
  return MARKETING_PRICING_PLANS.map((marketingPlan) => {
    const stripePlan = plansFromApiByCode.value.get(marketingPlan.code)
    const presentation = resolvePricingPlanPresentation(marketingPlan, stripePlan)

    return {
      ...marketingPlan,
      name: presentation.name,
      summary: presentation.summary,
      displayPrice: presentation.displayPrice,
      available: stripePlan?.available ?? true,
      unavailableReason: stripePlan?.unavailableReason ?? null,
    }
  })
})

function buildPricingCallbackAuthUrl(planCode: SubscriptionPlanCode): string {
  const path = `/pricing/callback?plan=${encodeURIComponent(planCode)}&action=auth&autostart=1`
  if (typeof window === 'undefined') return path
  return new URL(path, window.location.origin).toString()
}

function goToPricingCallbackAuth(planCode: SubscriptionPlanCode) {
  void router.push({
    path: '/pricing/callback',
    query: {
      plan: planCode,
      action: 'auth',
      autostart: '1',
    },
  })
}

async function loadPlans() {
  try {
    plansFromApi.value = await fetchStripeSubscriptionPlans()
  } catch {
    plansFromApi.value = []
  }
}

onMounted(() => {
  void loadPlans()
})
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
          {{ content.eyebrow }}
        </p>
        <h2
          data-sr
          data-sr-y="-30"
          v-html="content.title"
        />
        <p
          data-sr
          data-sr-y="30"
          class="pricing-subtitle"
        >
          {{ content.subtitle }}
        </p>
      </div>

      <div class="plans">
        <article
          v-for="(plan, index) in plans"
          :id="plan.id"
          :key="plan.id"
          class="plan"
          :class="[`is-${plan.tone}`, { 'is-featured': plan.tone === 'gold', 'is-expanded': isExpanded(plan.id) }]"
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

            <!-- Aperçu replié : quelques points clés + CTA toujours visibles -->
            <div
              v-if="!isExpanded(plan.id)"
              class="plan-preview"
            >
              <ul class="plan-preview-list">
                <li
                  v-for="item in plan.includes.slice(0, PREVIEW_INCLUDES_COUNT)"
                  :key="item"
                >
                  {{ item }}
                </li>
              </ul>
              <div class="plan-actions plan-actions-preview">
                <SignedIn>
                  <button
                    type="button"
                    class="plan-cta"
                    :disabled="!plan.available"
                    @click="goToPricingCallbackAuth(plan.code)"
                  >
                    {{ plan.cta }}
                  </button>
                </SignedIn>
                <SignedOut>
                  <SignUpButton
                    mode="redirect"
                    :force-redirect-url="buildPricingCallbackAuthUrl(plan.code)"
                  >
                    <button
                      type="button"
                      class="plan-cta"
                      :disabled="!plan.available"
                    >
                      {{ plan.cta }}
                    </button>
                  </SignUpButton>
                </SignedOut>
                <p
                  v-if="!plan.available && plan.unavailableReason"
                  class="plan-unavailable"
                >
                  {{ plan.unavailableReason }}
                </p>
                <p class="plan-helper">
                  {{ plan.helper }}
                </p>
              </div>
            </div>

            <button
              type="button"
              class="plan-toggle"
              :aria-expanded="isExpanded(plan.id)"
              :aria-controls="`plan-body-${plan.id}`"
              :id="`plan-toggle-${plan.id}`"
              @click="togglePlan(plan.id)"
            >
              <span class="plan-toggle-label">
                {{ isExpanded(plan.id) ? content.toggleCollapseLabel : content.toggleExpandLabel }}
              </span>
              <span class="plan-toggle-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </button>
          </div>

          <div
            :id="`plan-body-${plan.id}`"
            class="plan-body"
            :class="{ 'is-expanded': isExpanded(plan.id) }"
            role="region"
            :aria-labelledby="`plan-toggle-${plan.id}`"
            :aria-hidden="!isExpanded(plan.id)"
          >
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

            <p
              v-if="!plan.available && plan.unavailableReason"
              class="plan-unavailable"
            >
              {{ plan.unavailableReason }}
            </p>

            <div class="plan-actions">
              <SignedIn>
                <button
                  type="button"
                  class="plan-cta"
                  :disabled="!plan.available"
                  @click="goToPricingCallbackAuth(plan.code)"
                >
                  {{ plan.cta }}
                </button>
              </SignedIn>

              <SignedOut>
                <SignUpButton
                  mode="redirect"
                  :force-redirect-url="buildPricingCallbackAuthUrl(plan.code)"
                >
                  <button
                    type="button"
                    class="plan-cta"
                    :disabled="!plan.available"
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
        {{ content.accountPrefix }} <RouterLink to="/sign-in?redirect_url=%2Fpricing%2Fcallback">{{ content.accountLinkLabel }}</RouterLink>
      </p>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Landing/components/PricingSection/pricing-section.scss';
</style>
