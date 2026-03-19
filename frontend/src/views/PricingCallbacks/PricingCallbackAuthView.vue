<!-- File: src/views/PricingCallbacks/PricingCallbackAuthView.vue -->

<script setup lang="ts">
import { useAuth, useUser } from '@clerk/vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  activateStripeSubscriptionPlan,
  type SubscriptionPlanCode,
} from '@/domain/api/stripeSubscriptions'
import clerkToken from '@/utils/clerkToken'

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

function normalizeKnownStripeConnectError(message: string): string {
  const normalized = message.toLowerCase()
  if (normalized.includes('please review the responsibilities of managing losses')) {
    return 'Stripe Connect requiert une validation côté plateforme. Ouvrez https://dashboard.stripe.com/settings/connect/platform-profile, confirmez les responsabilités, puis relancez la configuration.'
  }
  return message
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const responseMessage = (error as { response?: { data?: { message?: unknown } } }).response?.data?.message
    if (typeof responseMessage === 'string' && responseMessage.trim()) return normalizeKnownStripeConnectError(responseMessage.trim())

    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return normalizeKnownStripeConnectError(maybeMessage.trim())
  }
  return fallback
}

const route = useRoute()
const router = useRouter()
const { isSignedIn } = useUser()
const { getToken } = useAuth()

const isProcessing = ref(false)
const isHandled = ref(false)
const errorMessage = ref<string | null>(null)

const selectedPlan = computed(() => parsePlanCode(route.query.plan))
const onboardingQuery = computed(() => readQueryValue(route.query.onboarding))
const intentQuery = computed(() => readQueryValue(route.query.intent))
const listingIdQuery = computed(() => readQueryValue(route.query.listingId))

function buildPersistentQuery(
  options?: { planCode?: SubscriptionPlanCode | null; extraQuery?: Record<string, string> },
): Record<string, string> {
  const query: Record<string, string> = {}
  const planCode = options?.planCode ?? null
  if (planCode) query.plan = planCode
  if (onboardingQuery.value) query.onboarding = onboardingQuery.value
  if (intentQuery.value) query.intent = intentQuery.value
  if (listingIdQuery.value) query.listingId = listingIdQuery.value
  return {
    ...query,
    ...(options?.extraQuery ?? {}),
  }
}

function buildAbsoluteUrl(path: string, query: Record<string, string>): string {
  const base = typeof window !== 'undefined' ? window.location.origin : ''

  if (!base) {
    const params = new URLSearchParams(query)
    return `${path}?${params.toString()}`
  }

  const url = new URL(path, base)
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

function buildPricingUrl(planCode?: SubscriptionPlanCode | null): string {
  return buildAbsoluteUrl('/pricing', buildPersistentQuery({ planCode }))
}

function buildCheckoutCallbackUrl(status: 'success' | 'canceled', planCode?: SubscriptionPlanCode | null): string {
  return buildAbsoluteUrl('/pricing/callback/checkout', buildPersistentQuery({
    planCode,
    extraQuery: { checkout: status },
  }))
}

async function refreshAuthToken() {
  if (!isSignedIn.value) {
    clerkToken.value = null
    return
  }

  try {
    clerkToken.value = await getToken.value()
  } catch {
    clerkToken.value = null
  }
}

async function runFlow() {
  if (isHandled.value || isProcessing.value) return
  if (!isSignedIn.value) return

  if (!selectedPlan.value) {
    await router.replace({ name: 'pricing', query: buildPersistentQuery() })
    return
  }

  isProcessing.value = true
  errorMessage.value = null

  try {
    await refreshAuthToken()

    const result = await activateStripeSubscriptionPlan({
      planCode: selectedPlan.value,
      successUrl: buildCheckoutCallbackUrl('success', selectedPlan.value),
      cancelUrl: buildCheckoutCallbackUrl('canceled', selectedPlan.value),
    })

    if (result.state === 'checkout_required' && result.checkout?.url) {
      isHandled.value = true
      window.location.assign(result.checkout.url)
      return
    }

    isHandled.value = true
    await router.replace({ name: 'pricing', query: buildPersistentQuery({ planCode: selectedPlan.value }) })
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error, 'Impossible de démarrer l’activation de votre plan.')
  } finally {
    isProcessing.value = false
  }
}

watch(
  () => isSignedIn.value,
  async (signedIn) => {
    if (!signedIn || isHandled.value) return
    await runFlow()
  },
  { immediate: true },
)
</script>

<template>
  <main class="pricing-callback-view">
    <section class="pricing-callback-card">
      <h1>Activation en cours</h1>
      <p v-if="!errorMessage">Connexion sécurisée en cours. Nous préparons votre abonnement...</p>
      <p
        v-if="errorMessage"
        class="is-error"
      >
        {{ errorMessage }}
      </p>

      <button
        v-if="errorMessage"
        type="button"
        class="callback-btn"
        @click="runFlow"
      >
        Réessayer
      </button>
      <RouterLink
        v-if="errorMessage"
        class="callback-link"
        :to="{ name: 'pricing', query: buildPersistentQuery({ planCode: selectedPlan }) }"
      >
        Revenir à la page des plans
      </RouterLink>
    </section>
  </main>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.pricing-callback-view {
  min-height: calc(100vh - 60px);
  display: grid;
  place-items: center;
  padding: 1rem;

  > .pricing-callback-card {
    width: min(34rem, 100%);
    padding: 1.2rem;
    border-radius: borders.$rounded-md;
    border: 1px solid rgba($secondary, 0.12);
    background: rgba($accent, 0.96);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    > h1 {
      margin: 0;
      color: rgba($secondary-text, 0.95);
      font-size: 1.35rem;
    }

    > p {
      margin: 0;
      color: rgba($secondary-text, 0.78);

      &.is-error {
        color: rgba($bad, 0.96);
      }
    }

    > .callback-btn {
      width: max-content;
      border: 0;
      border-radius: 0.5rem;
      padding: 0.55rem 0.8rem;
      cursor: pointer;
      background: rgba($secondary, 0.9);
      color: rgba($accent, 1);
    }

    > .callback-link {
      color: rgba($secondary, 0.9);
      text-decoration: underline;
      text-underline-offset: 0.2rem;
    }
  }
}
</style>
