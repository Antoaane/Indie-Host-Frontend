<!-- File: src/views/PricingView.vue -->

<script setup lang="ts">
import { SignInButton, SignUpButton, SignedIn, SignedOut, useAuth, useUser } from '@clerk/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  activateStripeSubscriptionPlan,
  confirmStripeSubscriptionCheckout,
  fetchMyStripeSubscriptionState,
  fetchStripeSubscriptionPlans,
  type StripeSubscriptionPlan,
  type StripeSubscriptionState,
  type SubscriptionPlanCode,
} from '@/domain/api/stripeSubscriptions'
import { getMarketingPricingPlan, type MarketingPricingPlan } from '@/domain/payments/pricingPlanCatalog'
import clerkToken from '@/utils/clerkToken'

const PLAN_ORDER: SubscriptionPlanCode[] = ['indiehost', 'superhost', 'megahost']

const route = useRoute()
const router = useRouter()
const { isSignedIn } = useUser()
const { getToken } = useAuth()

const plans = ref<StripeSubscriptionPlan[]>([])
const subscriptionState = ref<StripeSubscriptionState | null>(null)

const isLoadingPlans = ref(false)
const isLoadingState = ref(false)
const actionPlanCode = ref<SubscriptionPlanCode | null>(null)

const errorMessage = ref<string | null>(null)
const infoMessage = ref<string | null>(null)

const processedCheckoutKey = ref<string | null>(null)
const processedAutostartKey = ref<string | null>(null)

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
    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage.trim()
  }
  return fallback
}

function isTruthyFlag(value: unknown): boolean {
  const normalized = readQueryValue(value)?.toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

const selectedPlanQuery = computed(() => parsePlanCode(route.query.plan))
const checkoutStatusQuery = computed(() => readQueryValue(route.query.checkout))
const checkoutSessionIdQuery = computed(() => readQueryValue(route.query.session_id))
const autostartQueryEnabled = computed(() => isTruthyFlag(route.query.autostart))

const sortedPlans = computed(() => {
  return [...plans.value].sort((left, right) => PLAN_ORDER.indexOf(left.code) - PLAN_ORDER.indexOf(right.code))
})

type PricingDisplayPlan = StripeSubscriptionPlan & {
  marketing: MarketingPricingPlan
}

const displayPlans = computed<PricingDisplayPlan[]>(() => {
  return sortedPlans.value.map((plan) => ({
    ...plan,
    marketing: getMarketingPricingPlan(plan.code),
  }))
})

const currentPlanCode = computed(() => subscriptionState.value?.currentPlanCode ?? null)
const currentPlanName = computed(() => {
  const planCode = subscriptionState.value?.currentPlanCode
  if (planCode) return getMarketingPricingPlan(planCode).name
  return subscriptionState.value?.currentPlan?.name ?? 'Aucun plan actif'
})
const isUserSignedIn = computed(() => Boolean(isSignedIn.value))

const connectStatusLabel = computed(() => {
  const status = subscriptionState.value?.connect?.onboardingStatus ?? 'not_started'
  if (status === 'completed') return 'Stripe Connect prêt'
  if (status === 'pending') return 'Stripe Connect en attente'
  if (status === 'restricted') return 'Stripe Connect restreint'
  return 'Stripe Connect non démarré'
})

function isPlanActive(planCode: SubscriptionPlanCode): boolean {
  return currentPlanCode.value === planCode
}

function isPlanBusy(planCode: SubscriptionPlanCode): boolean {
  return actionPlanCode.value === planCode
}

function buildPricingReturnUrl(planCode: SubscriptionPlanCode, extraQuery?: Record<string, string>): string {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  const path = '/pricing'

  if (!base) {
    const query = new URLSearchParams({ plan: planCode, ...(extraQuery ?? {}) })
    return `${path}?${query.toString()}`
  }

  const url = new URL(path, base)
  url.searchParams.set('plan', planCode)

  for (const [key, value] of Object.entries(extraQuery ?? {})) {
    url.searchParams.set(key, value)
  }

  return url.toString()
}

function buildPostAuthRedirectUrl(planCode: SubscriptionPlanCode): string {
  return buildPricingReturnUrl(planCode, { autostart: '1' })
}

async function stripQueryKeys(keys: string[]) {
  const nextQuery = { ...route.query }
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(nextQuery, key)) {
      delete nextQuery[key]
    }
  }

  await router.replace({
    path: route.path,
    query: nextQuery,
  })
}

async function refreshAuthToken() {
  if (!isUserSignedIn.value) {
    clerkToken.value = null
    return
  }

  try {
    clerkToken.value = await getToken.value()
  } catch {
    clerkToken.value = null
  }
}

async function loadPlans() {
  isLoadingPlans.value = true

  try {
    plans.value = await fetchStripeSubscriptionPlans()
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error, 'Impossible de charger les plans pour le moment.')
  } finally {
    isLoadingPlans.value = false
  }
}

async function loadMyState({ sync = false }: { sync?: boolean } = {}) {
  if (!isUserSignedIn.value) {
    subscriptionState.value = null
    return
  }

  isLoadingState.value = true

  try {
    await refreshAuthToken()
    subscriptionState.value = await fetchMyStripeSubscriptionState({ sync })
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error, 'Impossible de récupérer votre état d’abonnement.')
  } finally {
    isLoadingState.value = false
  }
}

async function startPlanActivation(planCode: SubscriptionPlanCode, options?: { clearAutostart?: boolean }) {
  if (!isUserSignedIn.value) return

  actionPlanCode.value = planCode
  errorMessage.value = null

  try {
    await refreshAuthToken()

    const result = await activateStripeSubscriptionPlan({
      planCode,
      successUrl: buildPricingReturnUrl(planCode, { checkout: 'success' }),
      cancelUrl: buildPricingReturnUrl(planCode, { checkout: 'canceled' }),
    })

    if (result.message) {
      infoMessage.value = result.message
    }

    if (result.state === 'checkout_required' && result.checkout?.url) {
      window.location.assign(result.checkout.url)
      return
    }

    await loadMyState({ sync: true })

    if (options?.clearAutostart) {
      await stripQueryKeys(['autostart'])
    }
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error, 'Le changement de plan a échoué.')
  } finally {
    actionPlanCode.value = null
  }
}

async function handleCheckoutReturn() {
  if (!isUserSignedIn.value) return

  const checkoutStatus = checkoutStatusQuery.value
  if (!checkoutStatus) return

  if (checkoutStatus === 'canceled') {
    infoMessage.value = 'Paiement annulé. Aucun changement de plan n’a été appliqué.'
    await stripQueryKeys(['checkout', 'session_id'])
    return
  }

  if (checkoutStatus !== 'success') return

  const sessionId = checkoutSessionIdQuery.value
  if (!sessionId) {
    errorMessage.value = 'Retour Stripe incomplet: session checkout manquante.'
    await stripQueryKeys(['checkout'])
    return
  }

  actionPlanCode.value = selectedPlanQuery.value

  try {
    await refreshAuthToken()

    const confirmation = await confirmStripeSubscriptionCheckout({
      sessionId,
      planCode: selectedPlanQuery.value ?? undefined,
    })

    if (confirmation.state === 'confirmed') {
      infoMessage.value = confirmation.message ?? 'Votre abonnement est maintenant actif.'
      await loadMyState({ sync: true })
    } else {
      errorMessage.value = confirmation.message ?? 'Impossible de confirmer la session Stripe.'
    }
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error, 'Impossible de finaliser le retour Stripe.')
  } finally {
    actionPlanCode.value = null
    await stripQueryKeys(['checkout', 'session_id'])
  }
}

function resolveSignedInButtonLabel(plan: PricingDisplayPlan): string {
  if (isPlanBusy(plan.code)) return 'Traitement...'
  if (isPlanActive(plan.code)) return 'Plan actif'
  return `Choisir ${plan.marketing.name}`
}

watch(
  () => isUserSignedIn.value,
  async (signedIn) => {
    if (!signedIn) {
      subscriptionState.value = null
      clerkToken.value = null
      return
    }

    await refreshAuthToken()
    await loadMyState({ sync: true })
  },
)

watch(
  () => `${checkoutStatusQuery.value ?? ''}:${checkoutSessionIdQuery.value ?? ''}`,
  async (key) => {
    if (!key || key === ':') return
    if (processedCheckoutKey.value === key) return

    processedCheckoutKey.value = key
    await handleCheckoutReturn()
  },
)

watch(
  () => `${autostartQueryEnabled.value ? '1' : '0'}:${selectedPlanQuery.value ?? ''}:${isUserSignedIn.value ? '1' : '0'}`,
  async (key) => {
    if (processedAutostartKey.value === key) return

    const shouldAutostart = autostartQueryEnabled.value && Boolean(selectedPlanQuery.value) && isUserSignedIn.value
    if (!shouldAutostart || !selectedPlanQuery.value) return

    processedAutostartKey.value = key
    await startPlanActivation(selectedPlanQuery.value, { clearAutostart: true })
  },
)

onMounted(async () => {
  await loadPlans()

  if (isUserSignedIn.value) {
    await refreshAuthToken()
    await loadMyState({ sync: true })
  }
})
</script>

<template>
  <main class="pricing-unified app-pricing">
    <section class="pricing-shell">
      <div class="pricing-title">
        <p class="pricing-eyebrow">Activation IndieHost</p>
        <h1>Choisissez votre abonnement</h1>
        <p class="pricing-subtitle">
          Activez votre plan en quelques clics avec Stripe, puis pilotez vos réservations directes sans commission.
        </p>

        <div class="status-row">
          <span>{{ isUserSignedIn ? 'Session connectée' : 'Session non connectée' }}</span>
          <span>Plan actuel: {{ currentPlanName }}</span>
          <span>{{ connectStatusLabel }}</span>
        </div>
      </div>

      <p
        v-if="errorMessage"
        class="pricing-feedback is-error"
      >
        {{ errorMessage }}
      </p>

      <p
        v-if="infoMessage"
        class="pricing-feedback is-info"
      >
        {{ infoMessage }}
      </p>

      <p
        v-if="isLoadingPlans || isLoadingState"
        class="pricing-feedback is-neutral"
      >
        Chargement de votre configuration en cours...
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
            { 'is-active': isPlanActive(plan.code) },
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
            <h3>{{ plan.marketing.name }}</h3>
            <p class="price">{{ plan.marketing.displayPrice }}</p>
            <p class="summary">{{ plan.marketing.summary }}</p>
          </div>

          <div class="plan-body">
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
                  :disabled="!plan.available || isPlanActive(plan.code) || isPlanBusy(plan.code)"
                  @click="startPlanActivation(plan.code)"
                >
                  {{ resolveSignedInButtonLabel(plan) }}
                </button>
              </SignedIn>

              <SignedOut>
                <SignUpButton
                  mode="redirect"
                  :force-redirect-url="buildPostAuthRedirectUrl(plan.code)"
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
        Déjà client ? <RouterLink to="/sign-in?redirect_url=%2Fpricing">Se connecter</RouterLink>
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
}
</style>
