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

function formatMoney(amountMinor: number, currencyCode: string): string {
  const currency = (currencyCode || 'eur').toUpperCase()
  const amountMajor = Math.max(0, Number(amountMinor) || 0) / 100
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: amountMajor % 1 === 0 ? 0 : 2,
  }).format(amountMajor)
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

const currentPlanCode = computed(() => subscriptionState.value?.currentPlanCode ?? null)
const currentPlanName = computed(() => subscriptionState.value?.currentPlan?.name ?? 'Aucun plan actif')
const isUserSignedIn = computed(() => Boolean(isSignedIn.value))

const connectStatusLabel = computed(() => {
  const status = subscriptionState.value?.connect?.onboardingStatus ?? 'not_started'
  if (status === 'completed') return 'Stripe Connect prêt'
  if (status === 'pending') return 'Stripe Connect en attente'
  if (status === 'restricted') return 'Stripe Connect restreint'
  return 'Stripe Connect non démarré'
})

function getPlanFeatureLines(plan: StripeSubscriptionPlan): string[] {
  const baseLine = `${plan.maxActiveListings} annonce${plan.maxActiveListings > 1 ? 's' : ''} active${plan.maxActiveListings > 1 ? 's' : ''}`

  if (plan.code === 'indiehost') {
    return [baseLine, 'Paiements Stripe intégrés', 'Support de base']
  }

  if (plan.code === 'superhost') {
    return [baseLine, 'Automatisations avancées', 'Priorité support']
  }

  return [baseLine, 'Fonctions pro multi-logements', 'Accompagnement premium']
}

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

function resolveSignedInButtonLabel(plan: StripeSubscriptionPlan): string {
  if (isPlanBusy(plan.code)) return 'Traitement...'
  if (isPlanActive(plan.code)) return 'Plan actif'
  return `Choisir ${plan.name}`
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
  <main class="pricing-view">
    <section class="pricing-hero">
      <p class="eyebrow">Activation IndieHost</p>
      <h1>Choisissez votre abonnement</h1>
      <p>
        Cette page orchestre l’activation complète: identité utilisateur, abonnement Stripe et initialisation Stripe Connect.
      </p>

      <div class="status-row">
        <span>{{ isUserSignedIn ? 'Session connectée' : 'Session non connectée' }}</span>
        <span>Plan actuel: {{ currentPlanName }}</span>
        <span>{{ connectStatusLabel }}</span>
      </div>
    </section>

    <p
      v-if="errorMessage"
      class="feedback is-error"
    >
      {{ errorMessage }}
    </p>

    <p
      v-if="infoMessage"
      class="feedback is-info"
    >
      {{ infoMessage }}
    </p>

    <p
      v-if="isLoadingPlans || isLoadingState"
      class="feedback is-neutral"
    >
      Chargement de votre configuration en cours...
    </p>

    <section class="plans-grid">
      <article
        v-for="plan in sortedPlans"
        :key="plan.code"
        class="plan-card"
        :class="{
          'is-active': isPlanActive(plan.code),
          'is-unavailable': !plan.available,
        }"
      >
        <header>
          <p class="plan-name">{{ plan.name }}</p>
          <p class="plan-price">
            {{ formatMoney(plan.monthlyPriceMinor, plan.currency) }}
            <span>/{{ plan.billingInterval }}</span>
          </p>
        </header>

        <p class="plan-description">
          {{ plan.description }}
        </p>

        <ul>
          <li
            v-for="line in getPlanFeatureLines(plan)"
            :key="line"
          >
            {{ line }}
          </li>
        </ul>

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
                :disabled="!plan.available"
              >
                Créer un compte et continuer
              </button>
            </SignUpButton>

            <SignInButton
              mode="redirect"
              :force-redirect-url="buildPostAuthRedirectUrl(plan.code)"
            >
              <button
                type="button"
                class="ghost"
                :disabled="!plan.available"
              >
                J’ai déjà un compte
              </button>
            </SignInButton>
          </SignedOut>
        </div>
      </article>
    </section>
  </main>
</template>

<style lang="scss">
.pricing-view {
  --pricing-ink: #191921;
  --pricing-muted: #59596a;
  --pricing-line: rgba(17, 17, 23, 0.18);
  --pricing-soft: rgba(255, 255, 255, 0.86);
  --pricing-card: rgba(255, 255, 255, 0.94);
  --pricing-card-active: rgba(17, 17, 23, 0.96);
  --pricing-card-active-ink: #fbfbff;
  --pricing-accent: #00a37a;
  --pricing-danger: #b90f3b;

  min-height: 100vh;
  padding: 8.5rem 1rem 4rem;
  font-family: 'Outfit', sans-serif;
  background:
    radial-gradient(75rem 34rem at -8% 110%, rgba(0, 163, 122, 0.2), transparent 68%),
    radial-gradient(68rem 32rem at 110% -8%, rgba(33, 55, 146, 0.18), transparent 62%),
    linear-gradient(160deg, #efefe9, #f8f8ff 40%, #f4f5ee 100%);
}

.pricing-hero {
  max-width: 72rem;
  margin: 0 auto 1.5rem;
}

.eyebrow {
  margin: 0;
  font-weight: 700;
  font-size: 0.85rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pricing-accent);
}

.pricing-hero h1 {
  margin: 0.45rem 0 0;
  font-family: 'Fustat', sans-serif;
  font-size: clamp(2rem, 1.5rem + 2.2vw, 3.6rem);
  line-height: 1.08;
  color: var(--pricing-ink);
}

.pricing-hero > p {
  margin: 0.95rem 0 0;
  max-width: 62ch;
  color: var(--pricing-muted);
}

.status-row {
  margin-top: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.status-row > span {
  border: 1px solid var(--pricing-line);
  border-radius: 999px;
  padding: 0.4rem 0.7rem;
  font-size: 0.82rem;
  color: var(--pricing-ink);
  background: var(--pricing-soft);
}

.feedback {
  max-width: 72rem;
  margin: 0.75rem auto;
  border-radius: 0.9rem;
  padding: 0.75rem 0.9rem;
  font-size: 0.95rem;
}

.feedback.is-error {
  background: rgba(185, 15, 59, 0.12);
  color: var(--pricing-danger);
  border: 1px solid rgba(185, 15, 59, 0.3);
}

.feedback.is-info {
  background: rgba(0, 163, 122, 0.14);
  color: #00614b;
  border: 1px solid rgba(0, 163, 122, 0.32);
}

.feedback.is-neutral {
  background: rgba(25, 25, 33, 0.08);
  color: var(--pricing-ink);
  border: 1px solid var(--pricing-line);
}

.plans-grid {
  max-width: 72rem;
  margin: 1.25rem auto 0;
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 1rem;
}

.plan-card {
  border-radius: 1.1rem;
  border: 1px solid var(--pricing-line);
  background: var(--pricing-card);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  box-shadow: 0 0.9rem 2rem rgba(22, 22, 27, 0.08);
}

.plan-card.is-active {
  background: var(--pricing-card-active);
  border-color: rgba(255, 255, 255, 0.25);
  color: var(--pricing-card-active-ink);
}

.plan-card.is-active .plan-name,
.plan-card.is-active .plan-price,
.plan-card.is-active .plan-description,
.plan-card.is-active li {
  color: var(--pricing-card-active-ink);
}

.plan-card header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}

.plan-name {
  margin: 0;
  font-family: 'Fustat', sans-serif;
  font-size: 1.35rem;
  color: var(--pricing-ink);
}

.plan-price {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--pricing-ink);
}

.plan-price span {
  font-size: 0.85rem;
  font-weight: 500;
}

.plan-description {
  margin: 0;
  color: var(--pricing-muted);
  min-height: 2.8rem;
}

.plan-card ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.35rem;
}

.plan-card li {
  color: var(--pricing-ink);
  font-size: 0.95rem;
}

.plan-card li::before {
  content: '•';
  margin-right: 0.4rem;
  color: var(--pricing-accent);
}

.plan-unavailable {
  margin: 0;
  color: var(--pricing-danger);
  font-size: 0.86rem;
}

.plan-actions {
  margin-top: auto;
  display: grid;
  gap: 0.55rem;
}

.plan-actions .cl-rootBox {
  display: block;
}

.plan-actions button {
  width: 100%;
  border: 1px solid #121219;
  border-radius: 0.75rem;
  min-height: 2.8rem;
  padding: 0.6rem 0.9rem;
  font-weight: 700;
  font-size: 0.95rem;
  color: #f7f7ff;
  background: #111117;
  cursor: pointer;
  transition: transform 180ms ease, opacity 180ms ease, border-color 180ms ease;
}

.plan-actions button:hover:not(:disabled) {
  transform: translateY(-1px);
}

.plan-actions button.ghost {
  border-color: var(--pricing-line);
  background: transparent;
  color: var(--pricing-ink);
}

.plan-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (min-width: 900px) {
  .plans-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .plan-card {
    min-height: 28rem;
    padding: 1.2rem;
  }
}
</style>
