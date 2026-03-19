<!-- File: src/views/PricingCallbacks/PricingChecklistCallbackView.vue -->

<script setup lang="ts">
import { SignInButton, SignUpButton, SignedIn, SignedOut, useAuth, useUser } from '@clerk/vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  activateStripeSubscriptionPlan,
  confirmStripeSubscriptionCheckout,
  createStripeConnectOnboardingLink,
  fetchMyStripeSubscriptionState,
  syncMyStripeConnectState,
  type StripeSubscriptionState,
  type SubscriptionPlanCode,
} from '@/domain/api/stripeSubscriptions'
import { getListingsController } from '@/domain/listings/controller'
import { normalizeListingStatus } from '@/domain/listings/status'
import type { UserListingCard } from '@/domain/listings/types'
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
import { getMarketingPricingPlan } from '@/domain/payments/pricingPlanCatalog'
import clerkToken from '@/utils/clerkToken'
import { normalizeBundleForCreate } from '@/views/CreateListing/wizard/createListingDraft'

const CHECKOUT_SYNC_MAX_ATTEMPTS = 6
const CHECKOUT_SYNC_RETRY_DELAY_MS = 1500
const CONNECT_SYNC_MAX_ATTEMPTS = 6
const CONNECT_SYNC_RETRY_DELAY_MS = 1500

const CONNECT_REQUIREMENT_LABELS: Record<string, string> = {
  stripe_connect_account: 'compte Stripe Connect',
  stripe_connect_onboarding: 'onboarding Stripe Connect',
  stripe_connect_charges_enabled: 'activation des encaissements',
  stripe_connect_payouts_enabled: 'activation des virements',
}

const route = useRoute()
const router = useRouter()
const { isSignedIn } = useUser()
const { getToken } = useAuth()
const listingsController = getListingsController()

const listingOnboardingState = ref<ListingOnboardingState | null>(readListingOnboardingState())
const subscriptionState = ref<StripeSubscriptionState | null>(null)
const userListings = ref<UserListingCard[]>([])

const isLoadingState = ref(false)
const isLoadingListings = ref(false)
const isProcessingCallback = ref(false)
const isHydrating = ref(false)

const actionPlanCode = ref<SubscriptionPlanCode | null>(null)
const isCreatingListingForOnboarding = ref(false)
const isLaunchingConnect = ref(false)
const isPublishingFromOnboarding = ref(false)
const isKeepingBlockedFromOnboarding = ref(false)

const errorMessage = ref<string | null>(null)
const infoMessage = ref<string | null>(null)

let onboardingListingCreationPromise: Promise<string | null> | null = null

const handledCallbackSignature = ref<string | null>(null)
const handledAutoStartKey = ref<string | null>(null)

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

function parseBooleanQuery(value: unknown): boolean {
  const normalized = (readQueryValue(value) ?? '').toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

function parseCheckoutStatus(value: unknown): 'success' | 'canceled' | null {
  const normalized = (readQueryValue(value) ?? '').toLowerCase()
  if (normalized === 'success') return 'success'
  if (normalized === 'canceled') return 'canceled'
  return null
}

function parseCallbackAction(value: unknown): 'auth' | 'checkout' | 'connect' | null {
  const normalized = (readQueryValue(value) ?? '').toLowerCase()
  if (normalized === 'auth') return 'auth'
  if (normalized === 'checkout') return 'checkout'
  if (normalized === 'connect') return 'connect'
  return null
}

function parseConnectCallbackState(value: unknown): 'refresh' | 'return' {
  const normalized = (readQueryValue(value) ?? '').toLowerCase()
  if (normalized === 'refresh') return 'refresh'
  return 'return'
}

function resolveCallbackActionFromRouteName(routeName: unknown): 'auth' | 'checkout' | 'connect' | null {
  if (routeName === 'pricing-callback-auth') return 'auth'
  if (routeName === 'pricing-callback-checkout') return 'checkout'
  if (routeName === 'pricing-callback-connect') return 'connect'
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

function refreshOnboardingStateFromStorage() {
  listingOnboardingState.value = readListingOnboardingState()
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

function isActiveSubscriptionStatus(status?: string | null): boolean {
  const normalized = (status ?? '').trim().toLowerCase()
  return normalized === 'active' || normalized === 'trialing'
}

function isConnectReadyFromState(state: StripeSubscriptionState | null | undefined): boolean {
  if (!state) return false

  const readiness = state.publicationReadiness
  const readinessReady = Boolean(
    readiness
    && readiness.hasConnectAccount
    && readiness.connectOnboardingCompleted
    && readiness.chargesEnabled
    && readiness.payoutsEnabled,
  )
  if (readinessReady) return true

  const connect = state.connect
  return Boolean(
    connect?.accountId
    && connect?.onboardingStatus === 'completed'
    && connect?.chargesEnabled
    && connect?.payoutsEnabled,
  )
}

const selectedPlan = computed(() => parsePlanCode(route.query.plan))
const callbackAction = computed(() => parseCallbackAction(route.query.action) ?? resolveCallbackActionFromRouteName(route.name))
const checkoutStatus = computed(() => parseCheckoutStatus(route.query.checkout))
const checkoutSessionId = computed(() => readQueryValue(route.query.session_id))
const connectCallbackState = computed(() => parseConnectCallbackState(route.query.state))
const accountQuery = computed(() => readQueryValue(route.query.account))

const isListingOnboardingQueryEnabled = computed(() => isListingOnboardingQuery(route.query.onboarding))
const onboardingIntentQuery = computed<ListingOnboardingIntent | null>(() => parseListingOnboardingIntentQuery(route.query.intent))
const onboardingListingIdQuery = computed(() => readQueryValue(route.query.listingId))

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
const hasOnboardingDraft = computed(() => Boolean(listingOnboardingState.value?.draft))
const isOnboardingConnectMandatory = computed(() => {
  if (typeof listingOnboardingState.value?.connectMandatory === 'boolean') {
    return listingOnboardingState.value.connectMandatory
  }
  return onboardingIntent.value === 'publish'
})

const signUpInitialValues = computed(() => (onboardingEmail.value ? { emailAddress: onboardingEmail.value } : undefined))
const signInInitialValues = computed(() => (onboardingEmail.value ? { emailAddress: onboardingEmail.value } : undefined))

const currentPlanCode = computed(() => subscriptionState.value?.currentPlanCode ?? null)
const currentPlanName = computed(() => {
  const code = subscriptionState.value?.currentPlanCode
  if (code) return getMarketingPricingPlan(code).name
  return subscriptionState.value?.currentPlan?.name ?? 'Aucun plan actif'
})
const selectedPlanLabel = computed(() => {
  const code = selectedPlan.value
  if (!code) return null
  return getMarketingPricingPlan(code).name
})

const isSubscriptionActive = computed(() => {
  const status = subscriptionState.value?.subscription?.status
  return isActiveSubscriptionStatus(status) || Boolean(subscriptionState.value?.publicationReadiness?.hasActiveSubscription)
})

const isOnboardingConnectReady = computed(() => {
  return isConnectReadyFromState(subscriptionState.value)
})

const isOnboardingReadyForPublish = computed(() => Boolean(subscriptionState.value?.publicationReadiness?.canPublish))
const onboardingMissingRequirements = computed(() => subscriptionState.value?.publicationReadiness?.missingRequirements ?? [])
const onboardingMissingRequirementsLabels = computed(() => {
  return onboardingMissingRequirements.value.map((item) => CONNECT_REQUIREMENT_LABELS[item] ?? item)
})

const hasConnectAccount = computed(() => Boolean(subscriptionState.value?.connect?.accountId))
const connectStatusLabel = computed(() => {
  const status = subscriptionState.value?.connect?.onboardingStatus ?? 'not_started'
  if (status === 'completed') return 'Stripe Connect prêt'
  if (status === 'pending') return 'Stripe Connect en attente'
  if (status === 'restricted') return 'Stripe Connect restreint'
  return 'Stripe Connect non démarré'
})

const hasAnyListings = computed(() => userListings.value.length > 0)
const hasPublishedListings = computed(() => userListings.value.some((listing) => normalizeListingStatus(listing.status) === 'published'))
const onboardingListingStatus = computed(() => {
  const listingId = onboardingListingId.value
  if (!listingId) return null
  const listing = userListings.value.find((item) => item.listingId === listingId)
  return normalizeListingStatus(listing?.status)
})
const isOnboardingListingPublished = computed(() => onboardingListingStatus.value === 'published')

const isFirstVisitChecklist = computed(() => {
  return Boolean(isUserSignedIn.value && !hasPublishedListings.value && !hasConnectAccount.value)
})

const isOnboardingActionBusy = computed(() => {
  return Boolean(
    isProcessingCallback.value
    || actionPlanCode.value
    || isCreatingListingForOnboarding.value
    || isLaunchingConnect.value
    || isPublishingFromOnboarding.value
    || isKeepingBlockedFromOnboarding.value,
  )
})

type ChecklistState = 'done' | 'active' | 'todo'

type ChecklistItem = {
  id: string
  title: string
  detail: string
  state: ChecklistState
}

const checklistItems = computed<ChecklistItem[]>(() => {
  const items: ChecklistItem[] = []

  const authDone = isUserSignedIn.value
  const subscriptionDone = isSubscriptionActive.value
  const connectDone = isOnboardingConnectReady.value

  items.push({
    id: 'auth',
    title: 'Compte connecté',
    detail: authDone ? 'Session utilisateur active.' : 'Connectez-vous pour lancer votre activation.',
    state: authDone ? 'done' : 'active',
  })

  items.push({
    id: 'subscription',
    title: 'Abonnement actif',
    detail: subscriptionDone
      ? `Plan actif: ${currentPlanName.value}.`
      : selectedPlanLabel.value
        ? `Plan sélectionné: ${selectedPlanLabel.value}.`
        : 'Sélectionnez un plan pour continuer.',
    state: subscriptionDone ? 'done' : authDone ? 'active' : 'todo',
  })

  items.push({
    id: 'connect',
    title: 'Stripe Connect configuré',
    detail: connectDone
      ? 'Les paiements et les virements sont activés.'
      : 'Finalisez Stripe Connect pour encaisser vos réservations.',
    state: connectDone ? 'done' : subscriptionDone ? 'active' : 'todo',
  })

  if (isListingOnboardingActive.value) {
    const listingDone = Boolean(onboardingListingId.value)
    const publishDone = isOnboardingListingPublished.value

    items.push({
      id: 'listing',
      title: 'Annonce rattachée à l’onboarding',
      detail: listingDone
        ? `Annonce liée: ${onboardingListingId.value}.`
        : 'Création de l’annonce en mode privé dès activation du plan.',
      state: listingDone ? 'done' : connectDone ? 'active' : 'todo',
    })

    items.push({
      id: 'publish',
      title: 'Publication et réservations',
      detail: publishDone
        ? 'Annonce publiée: vous pouvez recevoir des réservations.'
        : isOnboardingReadyForPublish.value
          ? 'Tous les prérequis sont prêts, vous pouvez publier.'
          : 'Publication en attente des prérequis.',
      state: publishDone ? 'done' : listingDone && isOnboardingReadyForPublish.value ? 'active' : 'todo',
    })

    return items
  }

  items.push({
    id: 'listing-live',
    title: 'Annonce publiée',
    detail: hasPublishedListings.value
      ? 'Au moins une annonce est déjà publiée.'
      : 'Publiez votre annonce depuis l’éditeur pour ouvrir les réservations.',
    state: hasPublishedListings.value ? 'done' : connectDone ? 'active' : 'todo',
  })

  return items
})

const callbackSignature = computed(() => {
  const action = callbackAction.value
  if (!action) return null

  return JSON.stringify({
    action,
    plan: selectedPlan.value,
    checkout: checkoutStatus.value,
    sessionId: checkoutSessionId.value,
    connectState: connectCallbackState.value,
    account: accountQuery.value,
    path: route.path,
  })
})

const autoStartKey = computed(() => {
  if (!parseBooleanQuery(route.query.autostart)) return null
  if (!selectedPlan.value) return null
  return selectedPlan.value
})

function isPlanBusy(planCode: SubscriptionPlanCode): boolean {
  return actionPlanCode.value === planCode
}

function buildPersistentCallbackQuery(
  options?: { planCode?: SubscriptionPlanCode | null; extraQuery?: Record<string, string> },
): Record<string, string> {
  const query: Record<string, string> = {}

  const planCode = options?.planCode ?? selectedPlan.value
  if (planCode) query.plan = planCode
  if (isListingOnboardingActive.value) query.onboarding = 'listing'
  if (onboardingIntent.value) query.intent = onboardingIntent.value
  if (onboardingListingId.value) query.listingId = onboardingListingId.value

  return {
    ...query,
    ...(options?.extraQuery ?? {}),
  }
}

function buildAbsoluteUrl(path: string, query: Record<string, string>): string {
  const base = typeof window !== 'undefined' ? window.location.origin : ''

  if (!base) {
    const params = new URLSearchParams(query)
    const serialized = params.toString()
    return serialized ? `${path}?${serialized}` : path
  }

  const url = new URL(path, base)
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

function buildCallbackAbsoluteUrl(
  options?: { planCode?: SubscriptionPlanCode | null; extraQuery?: Record<string, string> },
): string {
  return buildAbsoluteUrl('/pricing/callback', buildPersistentCallbackQuery(options))
}

function buildCheckoutCallbackUrl(status: 'success' | 'canceled', planCode?: SubscriptionPlanCode | null): string {
  return buildCallbackAbsoluteUrl({
    planCode,
    extraQuery: {
      action: 'checkout',
      checkout: status,
    },
  })
}

function buildConnectCallbackUrl(
  nextState: 'refresh' | 'return',
  planCode?: SubscriptionPlanCode | null,
  listingId?: string | null,
): string {
  const extraQuery: Record<string, string> = {
    action: 'connect',
    state: nextState,
  }
  if (listingId) extraQuery.listingId = listingId

  return buildCallbackAbsoluteUrl({
    planCode,
    extraQuery,
  })
}

function buildAuthContinuationUrl(planCode?: SubscriptionPlanCode | null): string {
  const extraQuery: Record<string, string> = {}
  if (planCode) {
    extraQuery.action = 'auth'
    extraQuery.autostart = '1'
  }

  return buildCallbackAbsoluteUrl({
    planCode,
    extraQuery,
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

async function loadMyState({ sync = false }: { sync?: boolean } = {}) {
  if (!isUserSignedIn.value) {
    subscriptionState.value = null
    return
  }

  isLoadingState.value = true

  try {
    subscriptionState.value = await fetchMyStripeSubscriptionState({ sync })
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error, 'Impossible de récupérer votre état d’abonnement.')
  } finally {
    isLoadingState.value = false
  }
}

async function loadUserListings() {
  if (!isUserSignedIn.value) {
    userListings.value = []
    return
  }

  isLoadingListings.value = true

  try {
    userListings.value = await listingsController.fetchListings()
  } catch {
    userListings.value = []
  } finally {
    isLoadingListings.value = false
  }
}

async function ensureOnboardingListingCreated(): Promise<string | null> {
  const existing = onboardingListingId.value
  if (existing) return existing
  if (onboardingListingCreationPromise) return onboardingListingCreationPromise
  if (!isListingOnboardingActive.value) return null
  if (!isSubscriptionActive.value) return null

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
        path: '/pricing/callback',
        query: buildPersistentCallbackQuery({
          planCode: selectedPlan.value,
          extraQuery: {
            listingId,
          },
        }),
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

function updateOnboardingPublishDecision(decision: 'publish_now' | 'keep_blocked') {
  const state = listingOnboardingState.value
  if (!state) return

  const nextState = buildListingOnboardingState({
    source: state.source,
    email: state.email,
    intent: state.intent,
    draft: state.draft,
    backendListingId: state.backendListingId,
    connectMandatory: state.connectMandatory,
    connectAutoLaunchDone: true,
    publishDecision: decision,
    createdAtISO: state.createdAtISO,
  })

  persistListingOnboardingState(nextState)
  listingOnboardingState.value = nextState
}

async function clearTransientCallbackQuery(planCode?: SubscriptionPlanCode | null) {
  await router.replace({
    path: '/pricing/callback',
    query: buildPersistentCallbackQuery({
      planCode,
    }),
  })
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

    const targetPlanCode = selectedPlan.value ?? currentPlanCode.value ?? null
    const onboardingLink = await createStripeConnectOnboardingLink({
      accountId: accountQuery.value ?? subscriptionState.value?.connect?.accountId ?? undefined,
      refreshUrl: buildConnectCallbackUrl('refresh', targetPlanCode, ensuredListingId),
      returnUrl: buildConnectCallbackUrl('return', targetPlanCode, ensuredListingId),
      country: 'FR',
    })

    if (listingOnboardingState.value) {
      updateOnboardingPublishDecision(listingOnboardingState.value.publishDecision ?? 'keep_blocked')
    }

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

async function keepListingBlocked() {
  const listingId = await ensureOnboardingListingCreated()
  if (!listingId) return

  isKeepingBlockedFromOnboarding.value = true
  errorMessage.value = null

  try {
    await listingsController.patchListingDraft(listingId, {
      core: { status: 'blocked' },
    })

    updateOnboardingPublishDecision('keep_blocked')
    clearListingOnboardingState()
    listingOnboardingState.value = null

    infoMessage.value = 'Annonce conservée en mode bloqué.'
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

    updateOnboardingPublishDecision('publish_now')
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

async function waitForSubscriptionActivation(): Promise<boolean> {
  let attempt = 0

  while (attempt < CHECKOUT_SYNC_MAX_ATTEMPTS) {
    try {
      const state = await fetchMyStripeSubscriptionState({ sync: true })
      if (isActiveSubscriptionStatus(state.subscription?.status) || state.publicationReadiness?.hasActiveSubscription) {
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

async function syncConnectAfterReturn(): Promise<{
  ready: boolean
  latestState: StripeSubscriptionState | null
}> {
  let attempt = 0
  let lastError: unknown = null
  let latestState: StripeSubscriptionState | null = null

  while (attempt < CONNECT_SYNC_MAX_ATTEMPTS) {
    try {
      lastError = null
      await refreshAuthToken()
      await syncMyStripeConnectState({
        accountId: accountQuery.value ?? undefined,
      })

      latestState = await fetchMyStripeSubscriptionState({ sync: true })
      if (isConnectReadyFromState(latestState)) {
        return {
          ready: true,
          latestState,
        }
      }
    } catch (error) {
      lastError = error
    }

    attempt += 1
    if (attempt < CONNECT_SYNC_MAX_ATTEMPTS) {
      await wait(CONNECT_SYNC_RETRY_DELAY_MS)
    }
  }

  if (lastError) throw lastError

  return {
    ready: isConnectReadyFromState(latestState),
    latestState,
  }
}

async function relaunchConnect() {
  await refreshAuthToken()

  const state = await fetchMyStripeSubscriptionState({ sync: true })
  const targetPlanCode = selectedPlan.value ?? state.currentPlanCode ?? null
  const listingId = onboardingListingId.value

  const onboardingLink = await createStripeConnectOnboardingLink({
    accountId: accountQuery.value ?? state.connect.accountId ?? undefined,
    refreshUrl: buildConnectCallbackUrl('refresh', targetPlanCode, listingId),
    returnUrl: buildConnectCallbackUrl('return', targetPlanCode, listingId),
    country: 'FR',
  })

  window.location.assign(onboardingLink.url)
}

async function startPlanActivation(planCode: SubscriptionPlanCode, options?: { cleanupQuery?: boolean }) {
  if (!isUserSignedIn.value) return

  actionPlanCode.value = planCode
  errorMessage.value = null

  try {
    await refreshAuthToken()

    const result = await activateStripeSubscriptionPlan({
      planCode,
      successUrl: buildCheckoutCallbackUrl('success', planCode),
      cancelUrl: buildCheckoutCallbackUrl('canceled', planCode),
    })

    if (result.message) {
      infoMessage.value = result.message
    }

    if (result.state === 'checkout_required' && result.checkout?.url) {
      window.location.assign(result.checkout.url)
      return
    }

    await loadMyState({ sync: true })
    await loadUserListings()
    await ensureOnboardingListingCreated()

    if (options?.cleanupQuery) {
      await clearTransientCallbackQuery(planCode)
    }
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error, 'Le changement de plan a échoué.')
  } finally {
    actionPlanCode.value = null
  }
}

async function runAuthCallbackFlow() {
  if (!selectedPlan.value) {
    infoMessage.value = 'Connecté. Choisissez un plan pour lancer votre abonnement.'
    await clearTransientCallbackQuery()
    return
  }

  await startPlanActivation(selectedPlan.value, { cleanupQuery: true })
}

async function runCheckoutCallbackFlow() {
  if (checkoutStatus.value === 'canceled') {
    infoMessage.value = 'Paiement annulé. Vous pouvez réessayer quand vous voulez.'
    await clearTransientCallbackQuery(selectedPlan.value)
    return
  }

  if (checkoutStatus.value !== 'success') {
    await clearTransientCallbackQuery(selectedPlan.value)
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

  await loadMyState({ sync: true })
  await loadUserListings()
  await ensureOnboardingListingCreated()
  infoMessage.value = 'Paiement confirmé. Votre checklist a été mise à jour.'
  await clearTransientCallbackQuery(selectedPlan.value)
}

async function runConnectCallbackFlow() {
  if (connectCallbackState.value === 'refresh') {
    await relaunchConnect()
    return
  }

  const syncResult = await syncConnectAfterReturn()
  if (syncResult.latestState) {
    subscriptionState.value = syncResult.latestState
  }

  await loadMyState({ sync: true })
  await loadUserListings()
  await ensureOnboardingListingCreated()

  if (syncResult.ready || isOnboardingConnectReady.value) {
    infoMessage.value = 'Stripe Connect synchronisé avec succès.'
  } else {
    const missingConnectRequirements = onboardingMissingRequirements.value
      .filter((item) => item.startsWith('stripe_connect_'))
      .map((item) => CONNECT_REQUIREMENT_LABELS[item] ?? item)
    const details = missingConnectRequirements.length ? ` (${missingConnectRequirements.join(', ')})` : ''
    infoMessage.value = `Synchronisation effectuée, mais Stripe Connect reste incomplet${details}.`
  }

  await clearTransientCallbackQuery(selectedPlan.value)
}

async function processCallbackIfNeeded() {
  const action = callbackAction.value
  const signature = callbackSignature.value

  if (!isUserSignedIn.value || !action || !signature) return
  if (isProcessingCallback.value) return
  if (handledCallbackSignature.value === signature) return

  isProcessingCallback.value = true
  errorMessage.value = null

  try {
    if (action === 'auth') {
      await runAuthCallbackFlow()
    } else if (action === 'checkout') {
      await runCheckoutCallbackFlow()
    } else if (action === 'connect') {
      await runConnectCallbackFlow()
    }

    handledCallbackSignature.value = signature
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error, 'Impossible de finaliser cette étape de callback.')
  } finally {
    isProcessingCallback.value = false
  }
}

async function maybeAutoStartPlanActivation() {
  const key = autoStartKey.value
  if (!key || !selectedPlan.value || !isUserSignedIn.value) return
  if (callbackAction.value) return
  if (handledAutoStartKey.value === key) return

  handledAutoStartKey.value = key

  if (isSubscriptionActive.value && currentPlanCode.value === selectedPlan.value) {
    await clearTransientCallbackQuery(selectedPlan.value)
    return
  }

  await startPlanActivation(selectedPlan.value, { cleanupQuery: true })
}

async function hydrateSignedInContext({ sync = true }: { sync?: boolean } = {}) {
  if (!isUserSignedIn.value) {
    subscriptionState.value = null
    userListings.value = []
    clerkToken.value = null
    return
  }

  if (isHydrating.value) return
  isHydrating.value = true

  try {
    await refreshAuthToken()
    await processCallbackIfNeeded()
    await loadMyState({ sync })
    await loadUserListings()
    await ensureOnboardingListingCreated()
    await maybeAutoStartPlanActivation()
  } finally {
    isHydrating.value = false
  }
}

function resolveSignedInPlanCtaLabel(planCode: SubscriptionPlanCode): string {
  if (isPlanBusy(planCode)) return 'Activation...'
  return `Activer ${getMarketingPricingPlan(planCode).name}`
}

async function goToPricingSelection() {
  await router.push({
    name: 'pricing',
    query: buildPersistentCallbackQuery(),
  })
}

function resolvePreferredEditorListingId(): string | null {
  if (onboardingListingId.value) return onboardingListingId.value
  if (userListings.value[0]?.listingId) return userListings.value[0].listingId
  return null
}

async function goToEditor() {
  const listingId = resolvePreferredEditorListingId()
  await router.push({
    name: 'editor',
    query: listingId ? { listingId } : {},
  })
}

async function retryCurrentStep() {
  errorMessage.value = null

  if (!isUserSignedIn.value) return

  if (callbackAction.value) {
    handledCallbackSignature.value = null
    await processCallbackIfNeeded()
    return
  }

  if (selectedPlan.value && !isSubscriptionActive.value) {
    await startPlanActivation(selectedPlan.value)
    return
  }

  if (isSubscriptionActive.value && !isOnboardingConnectReady.value) {
    await launchConnectOnboarding()
    return
  }

  if (
    onboardingListingId.value
    && isOnboardingReadyForPublish.value
    && !isOnboardingListingPublished.value
  ) {
    await publishListingNow()
    return
  }

  await hydrateSignedInContext({ sync: true })
}

watch(
  () => route.fullPath,
  async () => {
    refreshOnboardingStateFromStorage()
    if (!isUserSignedIn.value) return
    await hydrateSignedInContext({ sync: true })
  },
)

watch(
  () => isUserSignedIn.value,
  async (signedIn) => {
    refreshOnboardingStateFromStorage()

    if (!signedIn) {
      subscriptionState.value = null
      userListings.value = []
      clerkToken.value = null
      return
    }

    await hydrateSignedInContext({ sync: true })
  },
  { immediate: true },
)
</script>

<template>
  <main class="pricing-checklist-view">
    <section class="checklist-shell">
      <div class="checklist-header">
        <p class="eyebrow">Activation hôte</p>
        <h1>Checklist avant les premières réservations</h1>
        <p class="subtitle">
          Cette page centralise chaque étape de finalisation: abonnement, Stripe Connect et publication.
        </p>

        <div class="status-row">
          <span>{{ isUserSignedIn ? 'Session connectée' : 'Session non connectée' }}</span>
          <span>Plan actuel: {{ currentPlanName }}</span>
          <span>{{ connectStatusLabel }}</span>
        </div>
      </div>

      <section
        v-if="isFirstVisitChecklist"
        class="first-visit-card"
      >
        <h2>Première activation détectée</h2>
        <p>
          Aucune annonce publiée et aucun compte Connect actif: suivez les étapes ci-dessous pour ouvrir la réception des réservations.
        </p>
      </section>

      <p
        v-if="isLoadingState || isLoadingListings || isProcessingCallback"
        class="feedback is-neutral"
      >
        Synchronisation en cours...
      </p>

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

      <ul class="checklist-items">
        <li
          v-for="item in checklistItems"
          :key="item.id"
          class="checklist-item"
          :class="[`is-${item.state}`]"
        >
          <span class="bullet" aria-hidden="true"></span>
          <div class="content">
            <h3>{{ item.title }}</h3>
            <p>{{ item.detail }}</p>
          </div>
        </li>
      </ul>

      <p
        v-if="onboardingMissingRequirements.length"
        class="feedback is-neutral"
      >
        Prérequis manquants: {{ onboardingMissingRequirementsLabels.join(', ') }}
      </p>

      <section class="actions-panel">
        <SignedOut>
          <div class="actions-row">
            <SignUpButton
              mode="redirect"
              :force-redirect-url="buildAuthContinuationUrl(selectedPlan)"
              :initial-values="signUpInitialValues"
            >
              <button
                type="button"
                class="action-btn"
              >
                Créer un compte
              </button>
            </SignUpButton>

            <SignInButton
              mode="redirect"
              :force-redirect-url="buildAuthContinuationUrl(selectedPlan)"
              :initial-values="signInInitialValues"
            >
              <button
                type="button"
                class="action-btn ghost"
              >
                J’ai déjà un compte
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          <div class="actions-row">
            <button
              v-if="selectedPlan && !isSubscriptionActive"
              type="button"
              class="action-btn"
              :disabled="isOnboardingActionBusy"
              @click="startPlanActivation(selectedPlan)"
            >
              {{ resolveSignedInPlanCtaLabel(selectedPlan) }}
            </button>

            <button
              v-else-if="!selectedPlan && !isSubscriptionActive"
              type="button"
              class="action-btn"
              :disabled="isOnboardingActionBusy"
              @click="goToPricingSelection"
            >
              Choisir un plan
            </button>

            <button
              v-if="isSubscriptionActive && !isOnboardingConnectReady"
              type="button"
              class="action-btn"
              :disabled="isOnboardingActionBusy"
              @click="launchConnectOnboarding"
            >
              {{ isLaunchingConnect ? 'Ouverture...' : 'Configurer Stripe Connect' }}
            </button>

            <button
              v-if="isSubscriptionActive && !isOnboardingConnectReady && !isOnboardingConnectMandatory && onboardingListingId"
              type="button"
              class="action-btn ghost"
              :disabled="isOnboardingActionBusy"
              @click="keepListingBlocked"
            >
              Continuer avec annonce bloquée
            </button>

            <button
              v-if="onboardingListingId && isOnboardingReadyForPublish && !isOnboardingListingPublished"
              type="button"
              class="action-btn"
              :disabled="isOnboardingActionBusy"
              @click="publishListingNow"
            >
              {{ isPublishingFromOnboarding ? 'Publication...' : 'Publier maintenant' }}
            </button>

            <button
              v-if="onboardingListingId && isOnboardingReadyForPublish && !isOnboardingListingPublished"
              type="button"
              class="action-btn ghost"
              :disabled="isOnboardingActionBusy"
              @click="keepListingBlocked"
            >
              Garder bloquée pour l’instant
            </button>

            <button
              v-if="hasAnyListings || onboardingListingId"
              type="button"
              class="action-btn ghost"
              :disabled="isOnboardingActionBusy"
              @click="goToEditor"
            >
              Ouvrir mes annonces
            </button>
          </div>
        </SignedIn>

        <button
          v-if="errorMessage"
          type="button"
          class="retry-btn"
          :disabled="isOnboardingActionBusy"
          @click="retryCurrentStep"
        >
          Réessayer cette étape
        </button>
      </section>
    </section>
  </main>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.pricing-checklist-view {
  min-height: calc(100vh - 60px);
  padding: clamp(5.5rem, 10vw, 7rem) clamp(0.9rem, 2.6vw, 1.6rem) clamp(1.25rem, 3vw, 2.25rem);
  background:
    radial-gradient(circle at 6% 0%, rgba($secondary, 0.16), transparent 50%),
    radial-gradient(circle at 95% 12%, rgba($good, 0.12), transparent 42%),
    linear-gradient(170deg, rgba($accent, 1), rgba($accent, 0.94));

  > .checklist-shell {
    width: min(100%, 72rem);
    margin: 0 auto;
    border-radius: clamp(1.1rem, 1.8vw, 1.6rem);
    border: 1px solid rgba($secondary, 0.16);
    background: rgba($accent, 0.92);
    box-shadow: 0 2rem 3.2rem rgba($secondary, 0.12);
    padding: clamp(1rem, 2vw, 1.5rem);
    display: flex;
    flex-direction: column;
    gap: 0.95rem;
  }

  .checklist-header {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;

    > .eyebrow {
      margin: 0;
      font-size: 0.76rem;
      letter-spacing: 0.11em;
      text-transform: uppercase;
      color: rgba($secondary, 0.7);
      font-weight: 700;
    }

    > h1 {
      margin: 0;
      color: rgba($secondary-text, 0.96);
      font-size: clamp(1.45rem, 2.3vw, 2rem);
      line-height: 1.2;
    }

    > .subtitle {
      margin: 0;
      color: rgba($secondary-text, 0.72);
      font-size: 0.98rem;
      max-width: 56ch;
    }

    > .status-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;

      > span {
        border-radius: 999px;
        border: 1px solid rgba($secondary, 0.16);
        background: rgba($secondary, 0.05);
        color: rgba($secondary-text, 0.76);
        padding: 0.3rem 0.55rem;
        font-size: 0.78rem;
      }
    }
  }

  .first-visit-card {
    border-radius: borders.$rounded-md;
    border: 1px solid rgba($good, 0.3);
    background: linear-gradient(140deg, rgba($good, 0.12), rgba($good, 0.04));
    padding: 0.75rem;

    > h2 {
      margin: 0;
      color: rgba($secondary-text, 0.94);
      font-size: 1rem;
    }

    > p {
      margin: 0.35rem 0 0;
      color: rgba($secondary-text, 0.76);
      font-size: 0.92rem;
      line-height: 1.45;
    }
  }

  .feedback {
    margin: 0;
    border-radius: 0.85rem;
    padding: 0.55rem 0.7rem;
    font-size: 0.9rem;

    &.is-neutral {
      border: 1px solid rgba($secondary, 0.18);
      background: rgba($secondary, 0.06);
      color: rgba($secondary-text, 0.74);
    }

    &.is-info {
      border: 1px solid rgba($good, 0.22);
      background: rgba($good, 0.1);
      color: rgba($secondary-text, 0.84);
    }

    &.is-error {
      border: 1px solid rgba($bad, 0.26);
      background: rgba($bad, 0.12);
      color: rgba($bad, 0.96);
    }
  }

  .checklist-items {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.55rem;

    > .checklist-item {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.6rem;
      align-items: flex-start;
      border-radius: 0.95rem;
      border: 1px solid rgba($secondary, 0.12);
      background: rgba($accent, 0.86);
      padding: 0.62rem 0.7rem;

      > .bullet {
        width: 0.86rem;
        height: 0.86rem;
        border-radius: 999px;
        margin-top: 0.2rem;
        border: 2px solid rgba($secondary, 0.2);
        background: transparent;
      }

      > .content {
        > h3 {
          margin: 0;
          color: rgba($secondary-text, 0.92);
          font-size: 0.96rem;
        }

        > p {
          margin: 0.2rem 0 0;
          color: rgba($secondary-text, 0.72);
          font-size: 0.88rem;
          line-height: 1.4;
        }
      }

      &.is-done {
        border-color: rgba($good, 0.32);
        background: rgba($good, 0.08);

        > .bullet {
          border-color: rgba($good, 0.9);
          background: rgba($good, 0.85);
        }
      }

      &.is-active {
        border-color: rgba($secondary, 0.26);
        background: rgba($secondary, 0.06);

        > .bullet {
          border-color: rgba($secondary, 0.72);
          background: rgba($secondary, 0.16);
        }
      }
    }
  }

  .actions-panel {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;

    > .actions-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
    }
  }

  .action-btn,
  .retry-btn {
    border: 0;
    border-radius: 0.65rem;
    padding: 0.58rem 0.85rem;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    background: rgba($secondary, 0.9);
    color: rgba($accent, 1);
    transition: transform 0.16s ease, opacity 0.16s ease;

    &:hover {
      transform: translateY(-1px);
    }

    &:disabled {
      opacity: 0.56;
      cursor: not-allowed;
      transform: none;
    }

    &.ghost {
      background: rgba($secondary, 0.08);
      color: rgba($secondary-text, 0.88);
      border: 1px solid rgba($secondary, 0.2);
    }
  }

  .retry-btn {
    align-self: flex-start;
    background: rgba($bad, 0.85);
    color: rgba($accent, 1);
  }

  @media (max-width: 640px) {
    > .checklist-shell {
      padding: 0.85rem;
    }

    .action-btn,
    .retry-btn {
      width: 100%;
      justify-content: center;
    }

    .actions-panel > .actions-row {
      flex-direction: column;
    }
  }
}
</style>
