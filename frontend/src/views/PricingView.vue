<!-- File: src/views/PricingView.vue -->

<script setup lang="ts">
import { SignUpButton, SignedIn, SignedOut, useUser } from '@clerk/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
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
  MARKETING_PRICING_PLANS,
  resolvePricingPlanPresentation,
  type MarketingPricingPlan,
} from '@/domain/payments/pricingPlanCatalog'
import landingFr from '@/locales/landing/fr.json'
import type { PricingSectionContent } from '@/views/Landing/types/content'

const PLAN_ORDER: SubscriptionPlanCode[] = ['indiehost', 'superhost', 'megahost']
const PREVIEW_INCLUDES_COUNT = 3

const route = useRoute()
const router = useRouter()
const { isSignedIn } = useUser()

const plans = ref<StripeSubscriptionPlan[]>([])
const listingOnboardingState = ref<ListingOnboardingState | null>(readListingOnboardingState())

const isLoadingPlans = ref(false)
const actionPlanCode = ref<SubscriptionPlanCode | null>(null)
const expandedPlanId = ref<string | null>(null)

const errorMessage = ref<string | null>(null)

const PRICING_SURFACE_CLASS = 'pricing-surface'

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

type PricingDisplayPlan = StripeSubscriptionPlan & {
  marketing: MarketingPricingPlan
  displayName: string
  displaySummary: string
  displayPrice: string
}

const plansFromApiByCode = computed(() => new Map(plans.value.map((plan) => [plan.code, plan])))

const displayPlans = computed<PricingDisplayPlan[]>(() => {
  return MARKETING_PRICING_PLANS
    .slice()
    .sort((left, right) => PLAN_ORDER.indexOf(left.code) - PLAN_ORDER.indexOf(right.code))
    .map((marketing) => {
      const stripePlan = plansFromApiByCode.value.get(marketing.code)
      const isForcedUnavailable = marketing.available === false
      const available = isForcedUnavailable ? false : (stripePlan?.available ?? true)
      const unavailableReason = isForcedUnavailable
        ? (marketing.unavailableReason ?? 'Momentanément indisponible')
        : (stripePlan?.unavailableReason ?? marketing.unavailableReason ?? null)
      const presentation = resolvePricingPlanPresentation(marketing, stripePlan)

      return {
        code: marketing.code,
        name: stripePlan?.name ?? marketing.name,
        description: stripePlan?.description ?? marketing.summary,
        maxActiveListings: stripePlan?.maxActiveListings ?? 0,
        currency: stripePlan?.currency ?? 'eur',
        monthlyPriceMinor: stripePlan?.monthlyPriceMinor ?? 0,
        billingInterval: stripePlan?.billingInterval ?? 'month',
        stripePriceId: stripePlan?.stripePriceId ?? null,
        available,
        unavailableReason,
        marketing,
        displayName: presentation.name,
        displaySummary: presentation.summary,
        displayPrice: presentation.displayPrice,
      }
    })
})

const pricingContent = landingFr.pricingSection as PricingSectionContent
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

function isPlanBusy(planCode: SubscriptionPlanCode): boolean {
  return actionPlanCode.value === planCode
}

function togglePlan(planId: string) {
  expandedPlanId.value = expandedPlanId.value === planId ? null : planId
}

function isExpanded(planId: string): boolean {
  return expandedPlanId.value === planId
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

function resolveSignedInPrimaryButtonLabel(plan: PricingDisplayPlan): string {
  if (isPlanBusy(plan.code)) return 'Redirection...'
  return plan.marketing.cta
}

function hasSecondaryCta(plan: PricingDisplayPlan): boolean {
  if (!plan.available) return false
  if (plan.code !== 'indiehost' && plan.code !== 'superhost') return false
  return typeof plan.marketing.secondaryCta === 'string' && plan.marketing.secondaryCta.trim().length > 0
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

function setPricingSurfaceState(isActive: boolean) {
  if (typeof document === 'undefined') return

  document.documentElement.classList.toggle(PRICING_SURFACE_CLASS, isActive)
  document.body.classList.toggle(PRICING_SURFACE_CLASS, isActive)
}

onMounted(async () => {
  setPricingSurfaceState(true)
  refreshOnboardingStateFromStorage()
  await loadPlans()
})

onUnmounted(() => {
  setPricingSurfaceState(false)
})
</script>

<template>
  <section class="pricing-unified app-pricing">
    <section class="pricing-shell">
      <div class="pricing-title">
        <p class="pricing-eyebrow">{{ pricingContent.eyebrow }}</p>
        <h1 v-html="pricingContent.title"></h1>
        <p class="pricing-subtitle">
          {{ pricingContent.subtitle }}
        </p>

        <div class="status-row">
          <span>{{ isUserSignedIn ? 'Session connectée' : 'Session non connectée' }}</span>
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
            <p
              v-if="plan.marketing.highlight"
              class="plan-highlight"
            >
              {{ plan.marketing.highlight }}
            </p>
            <h3>{{ plan.displayName }}</h3>
            <p class="price">{{ plan.displayPrice }}</p>
            <p class="summary">{{ plan.displaySummary }}</p>

            <div
              v-if="!isExpanded(plan.marketing.id)"
              class="plan-preview"
            >
              <ul class="plan-preview-list">
                <li
                  v-for="item in plan.marketing.includes.slice(0, PREVIEW_INCLUDES_COUNT)"
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
                    :disabled="!plan.available || isPlanBusy(plan.code)"
                    @click="goToPlanContinuation(plan.code)"
                  >
                    {{ resolveSignedInPrimaryButtonLabel(plan) }}
                  </button>
                  <button
                    v-if="hasSecondaryCta(plan)"
                    type="button"
                    class="plan-cta ghost"
                    :disabled="!plan.available || isPlanBusy(plan.code)"
                    @click="goToPlanContinuation(plan.code)"
                  >
                    {{ plan.marketing.secondaryCta }}
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
                  <SignUpButton
                    v-if="hasSecondaryCta(plan)"
                    mode="redirect"
                    :force-redirect-url="buildPostAuthRedirectUrl(plan.code)"
                    :initial-values="signUpInitialValues"
                  >
                    <button
                      type="button"
                      class="plan-cta ghost"
                      :disabled="!plan.available"
                    >
                      {{ plan.marketing.secondaryCta }}
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
                  {{ plan.marketing.helper }}
                </p>
              </div>
            </div>
          </div>

          <div
            :id="`plan-body-${plan.marketing.id}`"
            class="plan-body"
            :class="{ 'is-expanded': isExpanded(plan.marketing.id) }"
            role="region"
            :aria-labelledby="`plan-toggle-${plan.marketing.id}`"
            :aria-hidden="!isExpanded(plan.marketing.id)"
          >
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
                  {{ resolveSignedInPrimaryButtonLabel(plan) }}
                </button>
                <button
                  v-if="hasSecondaryCta(plan)"
                  type="button"
                  class="plan-cta ghost"
                  :disabled="!plan.available || isPlanBusy(plan.code)"
                  @click="goToPlanContinuation(plan.code)"
                >
                  {{ plan.marketing.secondaryCta }}
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
                <SignUpButton
                  v-if="hasSecondaryCta(plan)"
                  mode="redirect"
                  :force-redirect-url="buildPostAuthRedirectUrl(plan.code)"
                  :initial-values="signUpInitialValues"
                >
                  <button
                    type="button"
                    class="plan-cta ghost"
                    :disabled="!plan.available"
                  >
                    {{ plan.marketing.secondaryCta }}
                  </button>
                </SignUpButton>
              </SignedOut>
            </div>

            <p class="plan-helper">
              {{ plan.marketing.helper }}
            </p>
          </div>

          <button
            type="button"
            class="plan-toggle"
            :aria-expanded="isExpanded(plan.marketing.id)"
            :aria-controls="`plan-body-${plan.marketing.id}`"
            :id="`plan-toggle-${plan.marketing.id}`"
            @click="togglePlan(plan.marketing.id)"
          >
            <span class="plan-toggle-label">
              {{ isExpanded(plan.marketing.id) ? pricingContent.toggleCollapseLabel : pricingContent.toggleExpandLabel }}
            </span>
            <span class="plan-toggle-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </button>
        </article>
      </section>

      <p class="account-link">
        {{ pricingContent.accountPrefix }} <RouterLink to="/sign-in?redirect_url=%2Fpricing%2Fcallback">{{ pricingContent.accountLinkLabel }}</RouterLink>
      </p>
    </section>
  </section>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/views/Landing/components/PricingSection/pricing-section.scss';

html.pricing-surface,
body.pricing-surface {
  background: $secondary;
  overflow-y: auto;
}

body.pricing-surface #app,
body.pricing-surface #app > main,
body.pricing-surface #app > main > *,
body.pricing-surface .pricing-unified {
  background: $secondary;
}

body.pricing-surface #app > main,
body.pricing-surface #app > main > * {
  min-height: 0;
  overflow: visible;
}

.pricing-unified.app-pricing {
  width: 100%;
  min-height: 100dvh;
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
    align-items: start;
    gap: clamp(0.9rem, 1.8vw, 1.25rem);
  }
}
</style>
