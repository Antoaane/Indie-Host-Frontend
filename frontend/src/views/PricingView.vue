<!-- File: src/views/PricingView.vue -->

<script setup lang="ts">
import { SignInButton, SignUpButton, SignedIn, SignedOut, useAuth, useUser } from '@clerk/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  activateStripeSubscriptionPlan,
  createStripeConnectOnboardingLink,
  confirmStripeSubscriptionCheckout,
  fetchMyStripeSubscriptionState,
  fetchStripeSubscriptionPlans,
  syncMyStripeConnectState,
  type StripeSubscriptionPlan,
  type StripeSubscriptionState,
  type SubscriptionPlanCode,
} from '@/domain/api/stripeSubscriptions'
import { getListingsController } from '@/domain/listings/controller'
import {
  buildListingOnboardingState,
  clearListingOnboardingState,
  isListingOnboardingQuery,
  parseListingOnboardingIntentQuery,
  persistListingOnboardingState,
  readListingOnboardingState,
  type ListingOnboardingIntent,
  type ListingOnboardingState,
} from '@/domain/onboarding/listingOnboarding'
import { getMarketingPricingPlan, type MarketingPricingPlan } from '@/domain/payments/pricingPlanCatalog'
import clerkToken from '@/utils/clerkToken'
import { normalizeBundleForCreate } from '@/views/CreateListing/wizard/createListingDraft'

const PLAN_ORDER: SubscriptionPlanCode[] = ['indiehost', 'superhost', 'megahost']

const route = useRoute()
const router = useRouter()
const { isSignedIn } = useUser()
const { getToken } = useAuth()
const listingsController = getListingsController()

const plans = ref<StripeSubscriptionPlan[]>([])
const subscriptionState = ref<StripeSubscriptionState | null>(null)
const listingOnboardingState = ref<ListingOnboardingState | null>(readListingOnboardingState())

const isLoadingPlans = ref(false)
const isLoadingState = ref(false)
const actionPlanCode = ref<SubscriptionPlanCode | null>(null)
const isCreatingListingForOnboarding = ref(false)
const isLaunchingConnect = ref(false)
const isPublishingFromOnboarding = ref(false)
const isKeepingBlockedFromOnboarding = ref(false)
const autoConnectLaunchAttempted = ref(false)

const errorMessage = ref<string | null>(null)
const infoMessage = ref<string | null>(null)

const processedCheckoutKey = ref<string | null>(null)
const processedAutostartKey = ref<string | null>(null)
const processedConnectKey = ref<string | null>(null)
let onboardingListingCreationPromise: Promise<string | null> | null = null

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
    if (typeof responseMessage === 'string' && responseMessage.trim()) {
      return normalizeKnownStripeConnectError(responseMessage.trim())
    }

    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
      return normalizeKnownStripeConnectError(maybeMessage.trim())
    }
  }
  return fallback
}

function isTruthyFlag(value: unknown): boolean {
  const normalized = readQueryValue(value)?.toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

function isActiveSubscriptionStatus(status?: string | null): boolean {
  const normalized = (status ?? '').trim().toLowerCase()
  return normalized === 'active' || normalized === 'trialing'
}

function normalizeConnectQueryValue(value: unknown): 'return' | 'refresh' | null {
  const normalized = readQueryValue(value)?.toLowerCase()
  if (normalized === 'return') return 'return'
  if (normalized === 'refresh') return 'refresh'
  return null
}

function refreshOnboardingStateFromStorage() {
  listingOnboardingState.value = readListingOnboardingState()
}

const selectedPlanQuery = computed(() => parsePlanCode(route.query.plan))
const checkoutStatusQuery = computed(() => readQueryValue(route.query.checkout))
const checkoutSessionIdQuery = computed(() => readQueryValue(route.query.session_id))
const autostartQueryEnabled = computed(() => isTruthyFlag(route.query.autostart))
const connectQuery = computed(() => normalizeConnectQueryValue(route.query.connect))
const connectAccountQuery = computed(() => readQueryValue(route.query.account))
const isListingOnboardingQueryEnabled = computed(() => isListingOnboardingQuery(route.query.onboarding))
const onboardingIntentQuery = computed<ListingOnboardingIntent | null>(() => parseListingOnboardingIntentQuery(route.query.intent))
const onboardingListingIdQuery = computed(() => readQueryValue(route.query.listingId))

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
const isOnboardingConnectMandatory = computed(() => {
  if (typeof listingOnboardingState.value?.connectMandatory === 'boolean') {
    return listingOnboardingState.value.connectMandatory
  }
  return onboardingIntent.value === 'publish'
})
const hasOnboardingConnectAutoLaunchDone = computed(() => Boolean(listingOnboardingState.value?.connectAutoLaunchDone))
const hasOnboardingDraft = computed(() => Boolean(listingOnboardingState.value?.draft))
const onboardingPublicationReadiness = computed(() => subscriptionState.value?.publicationReadiness ?? null)
const isOnboardingSubscriptionActive = computed(() => {
  const status = subscriptionState.value?.subscription?.status
  return isActiveSubscriptionStatus(status) || Boolean(onboardingPublicationReadiness.value?.hasActiveSubscription)
})
const isOnboardingConnectReady = computed(() => {
  const readiness = onboardingPublicationReadiness.value
  if (readiness) {
    return Boolean(
      readiness.hasConnectAccount
      && readiness.connectOnboardingCompleted
      && readiness.chargesEnabled
      && readiness.payoutsEnabled,
    )
  }
  return false
})
const isOnboardingReadyForPublish = computed(() => Boolean(onboardingPublicationReadiness.value?.canPublish))
const onboardingMissingRequirements = computed(() => onboardingPublicationReadiness.value?.missingRequirements ?? [])
const isOnboardingActionBusy = computed(
  () => isCreatingListingForOnboarding.value || isLaunchingConnect.value || isPublishingFromOnboarding.value || isKeepingBlockedFromOnboarding.value,
)
const signUpInitialValues = computed(() => (onboardingEmail.value ? { emailAddress: onboardingEmail.value } : undefined))
const signInInitialValues = computed(() => (onboardingEmail.value ? { emailAddress: onboardingEmail.value } : undefined))

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

function buildPersistentPricingQuery(
  options?: { planCode?: SubscriptionPlanCode | null; extraQuery?: Record<string, string> },
): Record<string, string> {
  const query: Record<string, string> = {}
  const planCode = options?.planCode ?? null
  if (planCode) query.plan = planCode
  if (isListingOnboardingActive.value) query.onboarding = 'listing'
  if (onboardingIntent.value) query.intent = onboardingIntent.value
  if (onboardingListingId.value) query.listingId = onboardingListingId.value
  return {
    ...query,
    ...(options?.extraQuery ?? {}),
  }
}

function buildPricingReturnUrl(planCode?: SubscriptionPlanCode | null, extraQuery?: Record<string, string>): string {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  const path = '/pricing'
  const queryPayload = buildPersistentPricingQuery({
    planCode,
    extraQuery,
  })

  if (!base) {
    const query = new URLSearchParams(queryPayload)
    return `${path}?${query.toString()}`
  }

  const url = new URL(path, base)
  for (const [key, value] of Object.entries(queryPayload)) {
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

async function ensureOnboardingListingCreated(): Promise<string | null> {
  const existing = onboardingListingId.value
  if (existing) return existing
  if (onboardingListingCreationPromise) return onboardingListingCreationPromise
  if (!isListingOnboardingActive.value) return null
  if (!isOnboardingSubscriptionActive.value) return null

  const state = listingOnboardingState.value
  if (!state?.draft) return null
  const draft = state.draft

  onboardingListingCreationPromise = (async () => {
    isCreatingListingForOnboarding.value = true

    try {
      const payload = normalizeBundleForCreate(draft)
      payload.core = {
        ...(payload.core ?? {}),
        status: 'blocked',
      }

      const created = await listingsController.createListing(payload)
      const listingId = readQueryValue(created?.listingId)
      if (!listingId) {
        throw new Error("L'API n'a pas renvoyé d'identifiant d'annonce.")
      }

      const nextState = buildListingOnboardingState({
        source: state.source,
        email: state.email,
        intent: state.intent,
        draft,
        backendListingId: listingId,
        connectMandatory: isOnboardingConnectMandatory.value,
        connectAutoLaunchDone: state.connectAutoLaunchDone,
        publishDecision: state.publishDecision,
        createdAtISO: state.createdAtISO,
      })
      persistListingOnboardingState(nextState)
      listingOnboardingState.value = nextState

      await router.replace({
        path: route.path,
        query: {
          ...route.query,
          onboarding: 'listing',
          listingId,
          ...(onboardingIntent.value ? { intent: onboardingIntent.value } : {}),
        },
      })

      infoMessage.value = 'Annonce créée en mode privé (réservations bloquées) en attente de publication.'
      return listingId
    } catch (error) {
      errorMessage.value = resolveErrorMessage(error, 'Impossible de créer votre annonce après activation du plan.')
      return null
    } finally {
      isCreatingListingForOnboarding.value = false
      onboardingListingCreationPromise = null
    }
  })()

  return onboardingListingCreationPromise
}

function markConnectAutoLaunchDone() {
  const state = listingOnboardingState.value
  if (!state || state.connectAutoLaunchDone) return

  const nextState = buildListingOnboardingState({
    source: state.source,
    email: state.email,
    intent: state.intent,
    draft: state.draft,
    backendListingId: state.backendListingId,
    connectMandatory: state.connectMandatory,
    connectAutoLaunchDone: true,
    publishDecision: state.publishDecision,
    createdAtISO: state.createdAtISO,
  })
  persistListingOnboardingState(nextState)
  listingOnboardingState.value = nextState
}

async function launchConnectOnboardingWithListingId(listingId?: string | null) {
  if (!isUserSignedIn.value) return

  isLaunchingConnect.value = true
  errorMessage.value = null

  try {
    const ensuredListingId = listingId ?? await ensureOnboardingListingCreated()
    if (hasOnboardingDraft.value && !ensuredListingId) {
      throw new Error("Impossible de lancer Stripe Connect tant que l'annonce onboarding n'est pas créée.")
    }

    const targetPlanCode = selectedPlanQuery.value ?? currentPlanCode.value ?? null
    const onboardingLink = await createStripeConnectOnboardingLink({
      accountId: subscriptionState.value?.connect?.accountId ?? undefined,
      refreshUrl: buildPricingReturnUrl(targetPlanCode, {
        connect: 'refresh',
        ...(ensuredListingId ? { listingId: ensuredListingId } : {}),
      }),
      returnUrl: buildPricingReturnUrl(targetPlanCode, {
        connect: 'return',
        ...(ensuredListingId ? { listingId: ensuredListingId } : {}),
      }),
      country: 'FR',
    })

    window.location.assign(onboardingLink.url)
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error, 'Impossible de lancer Stripe Connect.')
  } finally {
    isLaunchingConnect.value = false
  }
}

async function launchConnectOnboarding() {
  await launchConnectOnboardingWithListingId()
}

async function syncConnectAfterReturn() {
  if (!isUserSignedIn.value) return

  try {
    await refreshAuthToken()
    await syncMyStripeConnectState({
      accountId: connectAccountQuery.value ?? undefined,
    })
    await loadMyState({ sync: true })
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error, 'Impossible de synchroniser Stripe Connect.')
  } finally {
    await stripQueryKeys(['connect', 'account', 'mode'])
  }
}

async function keepListingBlocked() {
  const listingId = await ensureOnboardingListingCreated()
  if (!listingId) return

  isKeepingBlockedFromOnboarding.value = true
  errorMessage.value = null

  try {
    await listingsController.patchListingDraft(listingId, {
      core: { status: 'blocked' },
    })

    clearListingOnboardingState()
    listingOnboardingState.value = null
    infoMessage.value = 'Annonce conservée en ligne avec réservations bloquées.'
    await router.push({
      name: 'editor',
      query: { listingId },
    })
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error, 'Impossible de verrouiller votre annonce en mode bloqué.')
  } finally {
    isKeepingBlockedFromOnboarding.value = false
  }
}

async function publishListingNow() {
  const listingId = await ensureOnboardingListingCreated()
  if (!listingId) return

  if (!isOnboardingReadyForPublish.value) {
    errorMessage.value = 'Les prérequis de publication ne sont pas encore remplis.'
    return
  }

  isPublishingFromOnboarding.value = true
  errorMessage.value = null

  try {
    await listingsController.patchListingDraft(listingId, {
      core: { status: 'published' },
    })

    clearListingOnboardingState()
    listingOnboardingState.value = null
    infoMessage.value = 'Votre annonce est publiée.'
    await router.push({
      name: 'editor',
      query: { listingId },
    })
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error, 'Impossible de publier votre annonce.')
  } finally {
    isPublishingFromOnboarding.value = false
  }
}

async function skipConnectForNow() {
  if (isOnboardingConnectMandatory.value) return
  await keepListingBlocked()
}

async function progressListingOnboarding() {
  if (!isListingOnboardingActive.value || !isUserSignedIn.value) return
  if (!isOnboardingSubscriptionActive.value) return

  const ensuredListingId = await ensureOnboardingListingCreated()
  if (hasOnboardingDraft.value && !ensuredListingId) return

  if (isOnboardingConnectReady.value) return
  if (autoConnectLaunchAttempted.value) return
  if (!isOnboardingConnectMandatory.value && hasOnboardingConnectAutoLaunchDone.value) return

  if (!isOnboardingConnectMandatory.value) {
    markConnectAutoLaunchDone()
    return
  }

  autoConnectLaunchAttempted.value = true
  await launchConnectOnboardingWithListingId(ensuredListingId)
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
    await progressListingOnboarding()

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
      await progressListingOnboarding()
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
    await progressListingOnboarding()
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
  { immediate: true },
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
  { immediate: true },
)

watch(
  () => `${connectQuery.value ?? ''}:${connectAccountQuery.value ?? ''}:${isUserSignedIn.value ? '1' : '0'}`,
  async (key) => {
    if (!key || key === '::0') return
    if (processedConnectKey.value === key) return

    const shouldHandle = (connectQuery.value === 'return' || connectQuery.value === 'refresh') && isUserSignedIn.value
    if (!shouldHandle) return

    processedConnectKey.value = key

    if (connectQuery.value === 'refresh') {
      await stripQueryKeys(['connect', 'account', 'mode'])
      await launchConnectOnboarding()
      return
    }

    await syncConnectAfterReturn()
    await progressListingOnboarding()
  },
  { immediate: true },
)

watch(
  () => route.fullPath,
  () => {
    refreshOnboardingStateFromStorage()
  },
)

onMounted(async () => {
  refreshOnboardingStateFromStorage()
  await loadPlans()

  if (isUserSignedIn.value) {
    await refreshAuthToken()
    await loadMyState({ sync: true })
    await progressListingOnboarding()
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

      <section
        v-if="isListingOnboardingActive && isUserSignedIn"
        class="pricing-onboarding-actions"
      >
        <p
          v-if="!isOnboardingSubscriptionActive"
          class="pricing-feedback is-neutral"
        >
          Sélectionnez un plan pour poursuivre l’onboarding de votre annonce.
        </p>

        <template v-else-if="!isOnboardingConnectReady">
          <p class="pricing-feedback is-neutral">
            Étape requise: finaliser Stripe Connect pour pouvoir encaisser les paiements.
          </p>
          <p
            v-if="onboardingMissingRequirements.length"
            class="pricing-feedback is-neutral"
          >
            Prérequis manquants: {{ onboardingMissingRequirements.join(', ') }}
          </p>
          <div class="onboarding-buttons">
            <button
              type="button"
              class="plan-cta"
              :disabled="isOnboardingActionBusy"
              @click="launchConnectOnboarding"
            >
              {{ isLaunchingConnect ? 'Ouverture...' : 'Configurer Stripe Connect' }}
            </button>
            <button
              v-if="!isOnboardingConnectMandatory"
              type="button"
              class="plan-cta ghost"
              :disabled="isOnboardingActionBusy"
              @click="skipConnectForNow"
            >
              Continuer sans finaliser Connect
            </button>
          </div>
        </template>

        <template v-else-if="onboardingListingId && isOnboardingReadyForPublish">
          <p class="pricing-feedback is-info">
            Votre compte est prêt. Voulez-vous publier votre annonce maintenant ?
          </p>
          <div class="onboarding-buttons">
            <button
              type="button"
              class="plan-cta"
              :disabled="isOnboardingActionBusy"
              @click="publishListingNow"
            >
              {{ isPublishingFromOnboarding ? 'Publication...' : 'Publier maintenant' }}
            </button>
            <button
              type="button"
              class="plan-cta ghost"
              :disabled="isOnboardingActionBusy"
              @click="keepListingBlocked"
            >
              Garder en mode réservé bloqué
            </button>
          </div>
        </template>
      </section>

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

  .pricing-onboarding-actions {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    margin-bottom: 1rem;
  }

  .onboarding-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.65rem;
  }
}
</style>
