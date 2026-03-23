<!-- File: src/views/PricingCallbacks/PricingCallbackConnectView.vue -->

<script setup lang="ts">
import { useAuth, useUser } from '@clerk/vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  createStripeConnectOnboardingLink,
  fetchMyStripeSubscriptionState,
  syncMyStripeConnectState,
  type SubscriptionPlanCode,
} from '@/domain/api/stripeSubscriptions'
import clerkToken from '@/utils/clerkToken'

const CONNECT_SYNC_MAX_ATTEMPTS = 6
const CONNECT_SYNC_RETRY_DELAY_MS = 1500

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

const route = useRoute()
const router = useRouter()
const { isSignedIn } = useUser()
const { getToken } = useAuth()

const isProcessing = ref(false)
const isHandled = ref(false)
const errorMessage = ref<string | null>(null)

const selectedPlan = computed(() => parsePlanCode(route.query.plan))
const callbackState = computed(() => {
  const state = readQueryValue(route.query.state)?.toLowerCase()
  if (state === 'refresh') return 'refresh' as const
  return 'return' as const
})
const accountQuery = computed(() => readQueryValue(route.query.account))
const onboardingQuery = computed(() => readQueryValue(route.query.onboarding))
const intentQuery = computed(() => readQueryValue(route.query.intent))
const listingIdQuery = computed(() => readQueryValue(route.query.listingId))

function buildPersistentQuery(options?: { planCode?: SubscriptionPlanCode | null; extraQuery?: Record<string, string> }): Record<string, string> {
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

function buildConnectCallbackUrl(nextState: 'return' | 'refresh', planCode?: SubscriptionPlanCode | null): string {
  return buildAbsoluteUrl('/pricing/callback/connect', buildPersistentQuery({
    planCode,
    extraQuery: { state: nextState },
  }))
}

function isConnectReadyFromState(state: Awaited<ReturnType<typeof fetchMyStripeSubscriptionState>>): boolean {
  const readiness = state.publicationReadiness
  if (!readiness) return false
  return Boolean(
    readiness.hasConnectAccount
    && readiness.connectOnboardingCompleted
    && readiness.chargesEnabled
    && readiness.payoutsEnabled,
  )
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

async function relaunchConnect() {
  await refreshAuthToken()

  const state = await fetchMyStripeSubscriptionState({ sync: true })
  const onboardingLink = await createStripeConnectOnboardingLink({
    accountId: accountQuery.value ?? state.connect.accountId ?? undefined,
    refreshUrl: buildConnectCallbackUrl('refresh', selectedPlan.value),
    returnUrl: buildConnectCallbackUrl('return', selectedPlan.value),
    country: 'FR',
  })

  isHandled.value = true
  window.location.assign(onboardingLink.url)
}

async function syncConnectAfterReturn() {
  let attempt = 0
  let lastError: unknown = null

  while (attempt < CONNECT_SYNC_MAX_ATTEMPTS) {
    try {
      lastError = null
      await refreshAuthToken()
      await syncMyStripeConnectState({
        accountId: accountQuery.value ?? undefined,
      })

      const state = await fetchMyStripeSubscriptionState({ sync: true })
      if (isConnectReadyFromState(state)) break
    } catch (error) {
      lastError = error
    }

    attempt += 1
    if (attempt < CONNECT_SYNC_MAX_ATTEMPTS) {
      await wait(CONNECT_SYNC_RETRY_DELAY_MS)
    }
  }

  if (lastError) {
    throw lastError
  }
}

async function runFlow() {
  if (isHandled.value || isProcessing.value) return
  if (!isSignedIn.value) return

  isProcessing.value = true
  errorMessage.value = null

  try {
    if (callbackState.value === 'refresh') {
      await relaunchConnect()
      return
    }

    await syncConnectAfterReturn()
    isHandled.value = true
    await router.replace({ name: 'pricing', query: buildPersistentQuery({ planCode: selectedPlan.value }) })
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error, 'Impossible de finaliser la synchronisation Stripe Connect.')
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
      <h1>Configuration Stripe Connect</h1>
      <p v-if="!errorMessage">Finalisation de votre configuration Stripe Connect en cours...</p>
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
