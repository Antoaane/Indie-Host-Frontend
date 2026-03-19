<!-- File: src/views/PricingView.vue -->

<script setup lang="ts">
import { SignInButton, SignUpButton, SignedIn, SignedOut, useUser } from '@clerk/vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  fetchStripeSubscriptionPlans,
  type StripeSubscriptionPlan,
  type SubscriptionPlanCode,
} from '@/domain/api/stripeSubscriptions'
import {
  isListingOnboardingQuery,
  parseListingOnboardingIntentQuery,
  readListingOnboardingState,
  type ListingOnboardingIntent,
  type ListingOnboardingState,
} from '@/domain/onboarding/listingOnboarding'
import {
  getMarketingPricingPlan,
  resolvePricingPlanPresentation,
  type MarketingPricingPlan,
} from '@/domain/payments/pricingPlanCatalog'

const PLAN_ORDER: SubscriptionPlanCode[] = ['indiehost', 'superhost', 'megahost']

const route = useRoute()
const router = useRouter()
const { isSignedIn } = useUser()

const plans = ref<StripeSubscriptionPlan[]>([])
const listingOnboardingState = ref<ListingOnboardingState | null>(readListingOnboardingState())

const isLoadingPlans = ref(false)
const actionPlanCode = ref<SubscriptionPlanCode | null>(null)

const errorMessage = ref<string | null>(null)

function readQueryValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (Array.isArray(value)) {
    const first = value[0]
    if (typeof first === 'string' && first.trim()) return first.trim()
  }
  return null
}

function parsePlanCode(value: unknown): SubscriptionPlanCode | null {
  const normalized = readQueryValue(value)
  if (normalized === 'indiehost' || normalized === 'superhost' || normalized === 'megahost') return normalized
  return null
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const responseMessage = (error as { response?: { data?: { message?: unknown } } }).response?.data?.message
    if (typeof responseMessage === 'string' && responseMessage.trim()) return responseMessage.trim()

    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage.trim()
  }
  return fallback
}

function refreshOnboardingStateFromStorage() {
  listingOnboardingState.value = readListingOnboardingState()
}

const selectedPlanQuery = computed(() => parsePlanCode(route.query.plan))
const isListingOnboardingQueryEnabled = computed(() => isListingOnboardingQuery(route.query.onboarding))
const onboardingIntentQuery = computed<ListingOnboardingIntent | null>(() => parseListingOnboardingIntentQuery(route.query.intent))
const onboardingListingIdQuery = computed(() => readQueryValue(route.query.listingId))

const sortedPlans = computed(() => {
  return [...plans.value].sort((left, right) => PLAN_ORDER.indexOf(left.code) - PLAN_ORDER.indexOf(right.code))
})

type PricingDisplayPlan = StripeSubscriptionPlan & {
  marketing: MarketingPricingPlan
  displayName: string
  displaySummary: string
  displayPrice: string
}

const displayPlans = computed<PricingDisplayPlan[]>(() => {
  return sortedPlans.value.map((plan) => {
    const marketing = getMarketingPricingPlan(plan.code)
    const presentation = resolvePricingPlanPresentation(marketing, plan)

    return {
      ...plan,
      marketing,
      displayName: presentation.name,
      displaySummary: presentation.summary,
      displayPrice: presentation.displayPrice,
    }
  })
})

const isUserSignedIn = computed(() => Boolean(isSignedIn.value))
const isListingOnboardingActive = computed(() => isListingOnboardingQueryEnabled.value || Boolean(listingOnboardingState.value))
const onboardingEmail = computed(() => listingOnboardingState.value?.email ?? '')
const onboardingIntent = computed<ListingOnboardingIntent | null>(() => {
  const fromStorage = listingOnboardingState.value?.intent
  if (fromStorage) return fromStorage
  return onboardingIntentQuery.value
})
const onboardingListingId = computed(() => {
  const fromStorage = listingOnboardingState.value?.backendListingId
  if (fromStorage) return fromStorage
  return onboardingListingIdQuery.value
})

const signUpInitialValues = computed(() => (onboardingEmail.value ? { emailAddress: onboardingEmail.value } : undefined))
const signInInitialValues = computed(() => (onboardingEmail.value ? { emailAddress: onboardingEmail.value } : undefined))

function isPlanBusy(planCode: SubscriptionPlanCode): boolean {
  return actionPlanCode.value === planCode
}

function buildPersistentCallbackQuery(
  options?: { planCode?: SubscriptionPlanCode | null; extraQuery?: Record<string, string> },
): Record<string, string> {
  const query: Record<string, string> = {}

  const planCode = options?.planCode ?? selectedPlanQuery.value
  if (planCode) query.plan = planCode
  if (isListingOnboardingActive.value) query.onboarding = 'listing'
  if (onboardingIntent.value) query.intent = onboardingIntent.value
  if (onboardingListingId.value) query.listingId = onboardingListingId.value

  return {
    ...query,
    ...(options?.extraQuery ?? {}),
  }
}

function buildPricingCallbackUrl(
  planCode?: SubscriptionPlanCode | null,
  options?: { extraQuery?: Record<string, string> },
): string {
  const query = buildPersistentCallbackQuery({
    planCode,
    extraQuery: options?.extraQuery,
  })

  const base = typeof window !== 'undefined' ? window.location.origin : ''
  if (!base) {
    const params = new URLSearchParams(query)
    const serialized = params.toString()
    return serialized ? `/pricing/callback?${serialized}` : '/pricing/callback'
  }

  const url = new URL('/pricing/callback', base)
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

function buildPostAuthRedirectUrl(planCode: SubscriptionPlanCode): string {
  return buildPricingCallbackUrl(planCode, {
    extraQuery: {
      action: 'auth',
      autostart: '1',
    },
  })
}

async function goToPlanContinuation(planCode: SubscriptionPlanCode) {
  if (!isUserSignedIn.value) return

  actionPlanCode.value = planCode
  errorMessage.value = null

  try {
    await router.push({
      path: '/pricing/callback',
      query: buildPersistentCallbackQuery({
        planCode,
        extraQuery: {
          action: 'auth',
          autostart: '1',
        },
      }),
    })
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error, 'Impossible de poursuivre vers l’activation du plan.')
  } finally {
    actionPlanCode.value = null
  }
}

function resolveSignedInButtonLabel(plan: PricingDisplayPlan): string {
  if (isPlanBusy(plan.code)) return 'Redirection...'
  return `Continuer avec ${plan.displayName}`
}

async function loadPlans() {
  isLoadingPlans.value = true
  errorMessage.value = null

  try {
    plans.value = await fetchStripeSubscriptionPlans()
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error, 'Impossible de charger les plans pour le moment.')
  } finally {
    isLoadingPlans.value = false
  }
}

onMounted(async () => {
  refreshOnboardingStateFromStorage()
  await loadPlans()
})
</script>

<template>
  <main class="pricing-unified app-pricing">
    <section class="pricing-shell">
      <div class="pricing-title">
        <p class="pricing-eyebrow">Activation IndieHost</p>
        <h1>Choisissez votre abonnement</h1>
        <p class="pricing-subtitle">
          Sélectionnez votre plan puis poursuivez sur la checklist d’activation (abonnement, Stripe Connect, publication).
        </p>

        <div class="status-row">
          <span>{{ isUserSignedIn ? 'Session connectée' : 'Session non connectée' }}</span>
        </div>

        <div
          v-if="isListingOnboardingActive"
          class="pricing-feedback is-neutral"
        >
          <strong>Onboarding annonce en cours.</strong>
          <span v-if="onboardingIntent === 'publish'">Objectif: publication immédiate.</span>
          <span v-else-if="onboardingIntent === 'setup'">Objectif: création de compte sans publication immédiate.</span>
          <span v-else>Annonce locale en attente de finalisation.</span>
        </div>
      </div>

      <p
        v-if="errorMessage"
        class="pricing-feedback is-error"
      >
        {{ errorMessage }}
      </p>

      <p
        v-if="isLoadingPlans"
        class="pricing-feedback is-neutral"
      >
        Chargement des plans en cours...
      </p>

      <section class="plans">
        <article
          v-for="plan in displayPlans"
          :id="plan.marketing.id"
          :key="plan.code"
          class="plan"
          :class="[
            `is-${plan.marketing.tone}`,
            { 'is-featured': plan.marketing.tone === 'gold' },
            { 'is-active': selectedPlanQuery === plan.code },
            { 'is-unavailable': !plan.available },
          ]"
        >
          <div class="plan-topline"></div>

          <div class="plan-head">
            <div class="plan-badge">
              <span class="plan-tier">{{ plan.marketing.tier }}</span>
            </div>
            <p
              v-if="plan.marketing.highlight"
              class="plan-highlight"
            >
              {{ plan.marketing.highlight }}
            </p>
            <h3>{{ plan.displayName }}</h3>
            <p class="price">{{ plan.displayPrice }}</p>
            <p class="summary">{{ plan.displaySummary }}</p>
          </div>

          <div class="plan-body is-expanded">
            <div class="block">
              <p class="block-label">Inclus</p>
              <ul>
                <li
                  v-for="item in plan.marketing.includes"
                  :key="item"
                >
                  {{ item }}
                </li>
              </ul>
            </div>

            <div
              v-if="plan.marketing.options?.length"
              class="block block-options"
            >
              <p class="block-label">Options</p>
              <ul>
                <li
                  v-for="option in plan.marketing.options"
                  :key="option"
                >
                  {{ option }}
                </li>
              </ul>
            </div>

            <p class="positioning">{{ plan.marketing.positioning }}</p>

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
                  :disabled="!plan.available || isPlanBusy(plan.code)"
                  @click="goToPlanContinuation(plan.code)"
                >
                  {{ resolveSignedInButtonLabel(plan) }}
                </button>
              </SignedIn>

              <SignedOut>
                <SignUpButton
                  mode="redirect"
                  :force-redirect-url="buildPostAuthRedirectUrl(plan.code)"
                  :initial-values="signUpInitialValues"
                >
                  <button
                    type="button"
                    class="plan-cta"
                    :disabled="!plan.available"
                  >
                    {{ plan.marketing.cta }}
                  </button>
                </SignUpButton>

                <SignInButton
                  mode="redirect"
                  :force-redirect-url="buildPostAuthRedirectUrl(plan.code)"
                  :initial-values="signInInitialValues"
                >
                  <button
                    type="button"
                    class="plan-cta ghost"
                    :disabled="!plan.available"
                  >
                    J’ai déjà un compte
                  </button>
                </SignInButton>
              </SignedOut>
            </div>

            <p class="plan-helper">
              {{ plan.marketing.helper }}
            </p>
          </div>
        </article>
      </section>

      <p class="account-link">
        Déjà client ? <RouterLink to="/sign-in?redirect_url=%2Fpricing%2Fcallback">Se connecter</RouterLink>
      </p>
    </section>
  </main>
</template>

<style lang="scss">
@use '@/views/Landing/components/PricingSection/pricing-section.scss';

.pricing-unified.app-pricing {
  width: 100%;
  min-height: auto;
  padding-top: clamp(6.25rem, 11vw, 8.5rem);
  padding-bottom: clamp(1rem, 2.4vw, 2rem);

  > .pricing-shell {
    width: min(100%, 92rem);
    margin: 0 auto;
    padding-left: clamp(0.75rem, 2vw, 1.5rem);
    padding-right: clamp(0.75rem, 2vw, 1.5rem);
    box-sizing: border-box;
  }

  .pricing-title {
    width: min(100%, 54rem);
  }

  .plans {
    grid-template-columns: repeat(auto-fit, minmax(18.5rem, 1fr));
    align-items: stretch;
    gap: clamp(0.9rem, 1.8vw, 1.25rem);
  }

  .plan .plan-body,
  .plan .plan-body.is-expanded {
    max-height: none;
    opacity: 1;
    overflow: visible;
    padding: 1rem 1.25rem 1.25rem;
  }

  @media (min-width: 1024px) {
    .plan .plan-body,
    .plan .plan-body.is-expanded {
      padding: 1.5rem;
    }
  }
}
</style>
