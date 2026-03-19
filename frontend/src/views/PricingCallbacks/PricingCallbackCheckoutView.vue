<!-- File: src/views/PricingCallbacks/PricingCallbackCheckoutView.vue -->

<script setup lang="ts">
import { useAuth, useUser } from '@clerk/vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  fetchMyStripeSubscriptionState,
  confirmStripeSubscriptionCheckout,
  type SubscriptionPlanCode,
} from '@/domain/api/stripeSubscriptions'
import clerkToken from '@/utils/clerkToken'

const CHECKOUT_SYNC_MAX_ATTEMPTS = 6
const CHECKOUT_SYNC_RETRY_DELAY_MS = 1500

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

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function isPlaceholderCheckoutSessionId(sessionId: string): boolean {
  const normalized = sessionId.trim().toLowerCase()
  return normalized.includes('checkout_session_id')
}

function isSubscriptionActiveStatus(status?: string | null): boolean {
  const normalized = (status ?? '').trim().toLowerCase()
  return normalized === 'active' || normalized === 'trialing'
}

const route = useRoute()
const router = useRouter()
const { isSignedIn } = useUser()
const { getToken } = useAuth()

const isProcessing = ref(false)
const isHandled = ref(false)
const errorMessage = ref<string | null>(null)

const selectedPlan = computed(() => parsePlanCode(route.query.plan))
const checkoutStatus = computed(() => readQueryValue(route.query.checkout))
const checkoutSessionId = computed(() => readQueryValue(route.query.session_id))
const onboardingQuery = computed(() => readQueryValue(route.query.onboarding))
const intentQuery = computed(() => readQueryValue(route.query.intent))
const listingIdQuery = computed(() => readQueryValue(route.query.listingId))

function buildPersistentQuery(options?: { planCode?: SubscriptionPlanCode | null }): Record<string, string> {
  const query: Record<string, string> = {}
  const planCode = options?.planCode ?? null
  if (planCode) query.plan = planCode
  if (onboardingQuery.value) query.onboarding = onboardingQuery.value
  if (intentQuery.value) query.intent = intentQuery.value
  if (listingIdQuery.value) query.listingId = listingIdQuery.value
  return query
}

function isSubscriptionActiveFromState(state: Awaited<ReturnType<typeof fetchMyStripeSubscriptionState>>): boolean {
  if (state.publicationReadiness?.hasActiveSubscription) return true
  return isSubscriptionActiveStatus(state.subscription?.status)
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

async function waitForSubscriptionActivation(): Promise<boolean> {
  let attempt = 0

  while (attempt < CHECKOUT_SYNC_MAX_ATTEMPTS) {
    try {
      const state = await fetchMyStripeSubscriptionState({ sync: true })
      if (isSubscriptionActiveFromState(state)) {
        return true
      }
    } catch {
      // Retry: Stripe webhooks / backend sync may still be propagating.
    }

    attempt += 1
    if (attempt < CHECKOUT_SYNC_MAX_ATTEMPTS) {
      await wait(CHECKOUT_SYNC_RETRY_DELAY_MS)
    }
  }

  return false
}

async function runFlow() {
  if (isHandled.value || isProcessing.value) return
  if (!isSignedIn.value) return

  isProcessing.value = true
  errorMessage.value = null

  try {
    if (checkoutStatus.value === 'canceled') {
      isHandled.value = true
      await router.replace({ name: 'pricing', query: buildPersistentQuery({ planCode: selectedPlan.value }) })
      return
    }

    if (checkoutStatus.value !== 'success') {
      isHandled.value = true
      await router.replace({ name: 'pricing', query: buildPersistentQuery({ planCode: selectedPlan.value }) })
      return
    }

    await refreshAuthToken()

    const sessionId = checkoutSessionId.value
    let confirmed = false
    let confirmationError: unknown = null

    if (!sessionId) {
      confirmationError = new Error('Retour Stripe incomplet: session checkout manquante.')
    } else if (!isPlaceholderCheckoutSessionId(sessionId)) {
      try {
        const confirmation = await confirmStripeSubscriptionCheckout({
          sessionId,
          planCode: selectedPlan.value ?? undefined,
        })

        if (confirmation.state === 'confirmed') {
          confirmed = true
        } else {
          confirmationError = new Error(confirmation.message ?? 'Impossible de confirmer la session Stripe.')
        }
      } catch (error) {
        confirmationError = error
      }
    } else {
      confirmationError = new Error('Session checkout Stripe non remplacée côté retour.')
    }

    if (!confirmed) {
      const activated = await waitForSubscriptionActivation()
      if (!activated) {
        if (confirmationError) throw confirmationError
        throw new Error('Le paiement a bien eu lieu mais la synchronisation de votre abonnement est encore en attente.')
      }
    }

    isHandled.value = true
    await router.replace({ name: 'pricing', query: buildPersistentQuery({ planCode: selectedPlan.value }) })
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error, 'Impossible de finaliser le paiement Stripe.')
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
      <h1>Confirmation du paiement</h1>
      <p v-if="!errorMessage">Validation de votre paiement en cours...</p>
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
