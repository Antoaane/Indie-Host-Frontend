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
const isDevMode = import.meta.env.DEV
const devLogs = ref<DevLogEntry[]>([])

let onboardingListingCreationPromise: Promise<string | null> | null = null

const handledCallbackSignature = ref<string | null>(null)
const handledAutoStartKey = ref<string | null>(null)
let devLogSequence = 0

type DevLogLevel = 'info' | 'error'

type DevLogEntry = {
  id: number
  level: DevLogLevel
  message: string
  timestampISO: string
}

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

function pushDevLog(level: DevLogLevel, message: string) {
  const normalized = message.trim()
  if (!normalized) return

  devLogSequence += 1
  devLogs.value = [
    {
      id: devLogSequence,
      level,
      message: normalized,
      timestampISO: new Date().toISOString(),
    },
    ...devLogs.value,
  ].slice(0, 80)
}

function clearDevLogs() {
  devLogs.value = []
}

function formatDevLogTime(timestampISO: string): string {
  const parsedDate = new Date(timestampISO)
  if (Number.isNaN(parsedDate.getTime())) return '--:--:--'
  return parsedDate.toLocaleTimeString('fr-FR', { hour12: false })
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

const hasAnyListings = computed(() => userListings.value.length > 0)
const hasPublishedListings = computed(() => userListings.value.some((listing) => normalizeListingStatus(listing.status) === 'published'))
const onboardingListingStatus = computed(() => {
  const listingId = onboardingListingId.value
  if (!listingId) return null
  const listing = userListings.value.find((item) => item.listingId === listingId)
  return normalizeListingStatus(listing?.status)
})
const isOnboardingListingPublished = computed(() => onboardingListingStatus.value === 'published')

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

type ChecklistState = 'done' | 'active' | 'upcoming'

type ChecklistItem = {
  id: string
  title: string
  detail: string
  state: ChecklistState
}

const checklistStateLabels: Record<ChecklistState, string> = {
  done: 'Terminé',
  active: 'À faire',
  upcoming: 'À venir',
}

function resolveListingStepDetail({
  authDone,
  subscriptionDone,
  connectDone,
}: {
  authDone: boolean
  subscriptionDone: boolean
  connectDone: boolean
}): string {
  if (isListingOnboardingActive.value) {
    if (onboardingIntent.value === 'setup') {
      if (onboardingListingId.value) return 'Annonce créée en mode privé. Vous pouvez finaliser quand vous voulez.'
      if (subscriptionDone) return 'Votre annonce est en préparation automatique.'
      return 'Votre annonce sera préparée après l’activation de l’abonnement.'
    }

    if (isOnboardingListingPublished.value) return 'Annonce publiée. Les réservations sont ouvertes.'
    if (isOnboardingReadyForPublish.value) return 'Tout est prêt. Vous pouvez publier maintenant.'
    if (onboardingListingId.value) {
      if (!isOnboardingConnectMandatory.value || connectDone) return 'Finalisez la mise en ligne de votre annonce.'
      return 'Activez Stripe Connect pour terminer la mise en ligne.'
    }
    if (subscriptionDone) return 'Votre annonce est en cours de préparation.'
    if (!authDone) return 'Connectez-vous pour lancer la création de votre annonce.'
    return 'Votre annonce sera créée après la validation de l’abonnement.'
  }

  if (hasPublishedListings.value) return 'Au moins une annonce est déjà en ligne.'
  if (hasAnyListings.value) return 'Dernière étape: publiez votre première annonce depuis l’éditeur.'
  return 'Créez et publiez votre première annonce depuis l’éditeur.'
}

const checklistItems = computed<ChecklistItem[]>(() => {
  const authDone = isUserSignedIn.value
  const subscriptionDone = isSubscriptionActive.value
  const connectDone = isOnboardingConnectReady.value
  const listingDone = isListingOnboardingActive.value
    ? onboardingIntent.value === 'setup'
      ? Boolean(onboardingListingId.value)
      : isOnboardingListingPublished.value
    : hasPublishedListings.value

  const listingReady = (() => {
    if (!authDone || !subscriptionDone) return false

    if (isListingOnboardingActive.value) {
      if (onboardingIntent.value === 'setup') return true
      if (isOnboardingConnectMandatory.value && !connectDone) return false
      return Boolean(onboardingListingId.value) || isOnboardingReadyForPublish.value
    }

    return connectDone
  })()

  return [
    {
      id: 'account',
      title: 'Compte',
      detail: authDone ? 'Votre compte est prêt.' : 'Créez votre compte pour commencer.',
      state: authDone ? 'done' : 'active',
    },
    {
      id: 'subscription',
      title: 'Abonnement',
      detail: subscriptionDone
        ? `Plan ${currentPlanName.value} actif.`
        : selectedPlanLabel.value
          ? `Plan ${selectedPlanLabel.value} sélectionné.`
          : 'Choisissez un plan adapté à votre activité.',
      state: subscriptionDone ? 'done' : authDone ? 'active' : 'upcoming',
    },
    {
      id: 'connect',
      title: 'Stripe Connect',
      detail: connectDone
        ? 'Paiements configurés pour recevoir vos revenus.'
        : isOnboardingConnectMandatory.value
          ? 'Configurez Stripe Connect pour activer les encaissements.'
          : 'Configuration recommandée pour activer les paiements.',
      state: connectDone ? 'done' : subscriptionDone ? 'active' : 'upcoming',
    },
    {
      id: 'listing',
      title: 'Annonce',
      detail: resolveListingStepDetail({ authDone, subscriptionDone, connectDone }),
      state: listingDone ? 'done' : listingReady ? 'active' : 'upcoming',
    },
  ]
})

const completedChecklistCount = computed(() => checklistItems.value.filter((item) => item.state === 'done').length)
const checklistProgressPercent = computed(() => {
  if (!checklistItems.value.length) return 0
  return Math.round((completedChecklistCount.value / checklistItems.value.length) * 100)
})
const isChecklistComplete = computed(() => checklistItems.value.every((item) => item.state === 'done'))
const nextChecklistItem = computed(() => checklistItems.value.find((item) => item.state === 'active') ?? null)
const nextStepTitle = computed(() => {
  if (isChecklistComplete.value) return 'Activation terminée'
  return nextChecklistItem.value?.title ?? 'Finalisation en cours'
})
const nextStepDetail = computed(() => {
  if (!isUserSignedIn.value) return 'Créez votre compte puis revenez ici pour poursuivre.'
  if (isChecklistComplete.value) return 'Tout est prêt. Vous pouvez maintenant gérer vos annonces.'
  return nextChecklistItem.value?.detail ?? 'Nous mettons à jour votre progression.'
})

type PrimaryActionId = 'activate-plan' | 'choose-plan' | 'connect' | 'publish' | 'open-editor' | 'refresh'
type PrimaryAction = {
  id: PrimaryActionId
  label: string
}

const primaryAction = computed<PrimaryAction>(() => {
  if (selectedPlan.value && !isSubscriptionActive.value) {
    return {
      id: 'activate-plan',
      label: resolveSignedInPlanCtaLabel(selectedPlan.value),
    }
  }

  if (!selectedPlan.value && !isSubscriptionActive.value) {
    return {
      id: 'choose-plan',
      label: 'Choisir mon abonnement',
    }
  }

  if (isSubscriptionActive.value && !isOnboardingConnectReady.value) {
    return {
      id: 'connect',
      label: isLaunchingConnect.value ? 'Ouverture de Stripe...' : 'Configurer Stripe Connect',
    }
  }

  if (onboardingListingId.value && isOnboardingReadyForPublish.value && !isOnboardingListingPublished.value) {
    return {
      id: 'publish',
      label: isPublishingFromOnboarding.value ? 'Publication...' : 'Publier mon annonce',
    }
  }

  if (isSubscriptionActive.value) {
    return {
      id: 'open-editor',
      label: hasAnyListings.value || onboardingListingId.value ? 'Ouvrir mes annonces' : 'Créer ma première annonce',
    }
  }

  return {
    id: 'refresh',
    label: 'Actualiser ma progression',
  }
})

const canKeepListingBlocked = computed(() => {
  if (!isUserSignedIn.value || !onboardingListingId.value) return false
  if (!isSubscriptionActive.value) return false

  if (!isOnboardingConnectMandatory.value && !isOnboardingConnectReady.value) return true
  if (isOnboardingReadyForPublish.value && !isOnboardingListingPublished.value) return true

  return false
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

async function handlePrimaryAction() {
  errorMessage.value = null

  if (!isUserSignedIn.value) return

  switch (primaryAction.value.id) {
    case 'activate-plan':
      if (selectedPlan.value) {
        await startPlanActivation(selectedPlan.value)
      }
      break
    case 'choose-plan':
      await goToPricingSelection()
      break
    case 'connect':
      await launchConnectOnboarding()
      break
    case 'publish':
      await publishListingNow()
      break
    case 'open-editor':
      await goToEditor()
      break
    case 'refresh':
      if (callbackAction.value) {
        handledCallbackSignature.value = null
        await processCallbackIfNeeded()
      } else {
        await hydrateSignedInContext({ sync: true })
      }
      break
  }
}

watch(
  () => infoMessage.value,
  (message, previousMessage) => {
    if (!message || message === previousMessage) return
    pushDevLog('info', message)
  },
)

watch(
  () => errorMessage.value,
  (message, previousMessage) => {
    if (!message || message === previousMessage) return
    pushDevLog('error', message)
  },
)

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
      <header class="checklist-header">
        <p class="eyebrow">Activation hôte</p>
        <h1>Finalisez votre espace avant les premières réservations</h1>
        <p class="subtitle">
          Suivez les étapes dans l’ordre. Nous mettons en avant uniquement la prochaine action utile.
        </p>
      </header>

      <section class="progress-panel">
        <div class="progress-head">
          <p class="progress-label">Progression</p>
          <p class="progress-value">{{ completedChecklistCount }} / {{ checklistItems.length }} étapes</p>
        </div>
        <div
          class="progress-track"
          role="progressbar"
          :aria-valuemin="0"
          :aria-valuemax="100"
          :aria-valuenow="checklistProgressPercent"
        >
          <span
            class="progress-fill"
            :style="{ width: `${checklistProgressPercent}%` }"
          ></span>
        </div>
      </section>

      <ul class="checklist-items">
        <li
          v-for="(item, index) in checklistItems"
          :key="item.id"
          class="checklist-item"
          :class="[`is-${item.state}`]"
        >
          <span class="step-index">{{ index + 1 }}</span>
          <div class="content">
            <div class="title-row">
              <h2>{{ item.title }}</h2>
              <span class="state-chip">{{ checklistStateLabels[item.state] }}</span>
            </div>
            <p>{{ item.detail }}</p>
          </div>
        </li>
      </ul>

      <section class="next-step-card">
        <p class="next-step-eyebrow">Prochaine étape</p>
        <h2>{{ nextStepTitle }}</h2>
        <p class="next-step-detail">{{ nextStepDetail }}</p>
        <p
          v-if="isLoadingState || isLoadingListings || isProcessingCallback"
          class="sync-note"
        >
          Mise à jour de votre progression...
        </p>

        <SignedOut>
          <div class="actions-panel">
            <SignUpButton
              mode="redirect"
              :force-redirect-url="buildAuthContinuationUrl(selectedPlan)"
              :initial-values="signUpInitialValues"
            >
              <button
                type="button"
                class="action-btn"
              >
                Créer mon compte
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
                Me connecter
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          <div class="actions-panel">
            <button
              type="button"
              class="action-btn"
              :disabled="isOnboardingActionBusy"
              @click="handlePrimaryAction"
            >
              {{ primaryAction.label }}
            </button>

            <button
              v-if="canKeepListingBlocked"
              type="button"
              class="action-btn ghost"
              :disabled="isOnboardingActionBusy"
              @click="keepListingBlocked"
            >
              Continuer plus tard
            </button>

            <button
              v-if="(hasAnyListings || onboardingListingId) && primaryAction.id !== 'open-editor'"
              type="button"
              class="action-btn ghost"
              :disabled="isOnboardingActionBusy"
              @click="goToEditor"
            >
              Ouvrir mes annonces
            </button>
          </div>
        </SignedIn>
      </section>

      <section
        v-if="isDevMode"
        class="dev-console"
      >
        <div class="dev-console-head">
          <h2>Console technique (dev)</h2>
          <button
            type="button"
            class="dev-console-clear"
            :disabled="!devLogs.length"
            @click="clearDevLogs"
          >
            Vider
          </button>
        </div>

        <p
          v-if="!devLogs.length"
          class="dev-console-empty"
        >
          Aucun message technique.
        </p>

        <ul
          v-else
          class="dev-console-list"
        >
          <li
            v-for="entry in devLogs"
            :key="entry.id"
            class="dev-console-item"
            :class="[`is-${entry.level}`]"
          >
            <span class="time">{{ formatDevLogTime(entry.timestampISO) }}</span>
            <span class="level">{{ entry.level }}</span>
            <span class="message">{{ entry.message }}</span>
          </li>
        </ul>
      </section>
    </section>
  </main>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.pricing-checklist-view {
  min-height: calc(100vh - 60px);
  padding: clamp(5.4rem, 9vw, 6.8rem) clamp(1rem, 2.8vw, 1.85rem) clamp(1.8rem, 3vw, 2.8rem);
  background:
    radial-gradient(circle at 8% 0%, rgba($secondary, 0.1), transparent 50%),
    radial-gradient(circle at 92% 12%, rgba($secondary, 0.06), transparent 45%),
    linear-gradient(170deg, rgba($accent, 1), rgba($accent, 0.97));

  > .checklist-shell {
    width: min(100%, 66rem);
    margin: 0 auto;
    border-radius: clamp(1.1rem, 1.8vw, 1.7rem);
    border: 1px solid rgba($secondary, 0.14);
    background: rgba($accent, 0.94);
    box-shadow: 0 1.6rem 3.2rem rgba($secondary, 0.1);
    padding: clamp(1.05rem, 2.2vw, 1.7rem);
    display: flex;
    flex-direction: column;
    gap: clamp(0.9rem, 1.6vw, 1.2rem);
  }

  .checklist-header {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;

    > .eyebrow {
      margin: 0;
      font-size: 0.76rem;
      letter-spacing: 0.13em;
      text-transform: uppercase;
      color: rgba($secondary, 0.68);
      font-weight: 700;
    }

    > h1 {
      margin: 0;
      color: rgba($secondary-text, 0.95);
      font-size: clamp(1.42rem, 2.6vw, 2.18rem);
      line-height: 1.2;
    }

    > .subtitle {
      margin: 0;
      color: rgba($secondary-text, 0.72);
      font-size: 0.96rem;
      max-width: 58ch;
    }
  }

  .progress-panel {
    border-radius: borders.$rounded-md;
    border: 1px solid rgba($secondary, 0.14);
    background: rgba($accent, 0.9);
    padding: 0.72rem 0.82rem;
    display: flex;
    flex-direction: column;
    gap: 0.42rem;

    > .progress-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.55rem;
    }

    .progress-label,
    .progress-value {
      margin: 0;
      font-size: 0.82rem;
      color: rgba($secondary-text, 0.72);
      font-weight: 600;
    }

    > .progress-track {
      width: 100%;
      height: 0.52rem;
      border-radius: borders.$rounded;
      background: rgba($secondary, 0.12);
      overflow: hidden;

      > .progress-fill {
        display: block;
        height: 100%;
        width: 0;
        border-radius: inherit;
        background: linear-gradient(90deg, rgba($secondary, 0.9), rgba($secondary, 0.68));
        transition: width 0.22s ease;
      }
    }
  }

  .checklist-items {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.58rem;

    > .checklist-item {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.7rem;
      align-items: flex-start;
      border-radius: 0.95rem;
      border: 1px solid rgba($secondary, 0.14);
      background: rgba($accent, 0.9);
      padding: 0.72rem 0.75rem;

      > .step-index {
        min-width: 1.55rem;
        height: 1.55rem;
        border-radius: borders.$rounded;
        border: 1px solid rgba($secondary, 0.22);
        background: rgba($secondary, 0.06);
        color: rgba($secondary-text, 0.75);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 0.77rem;
        font-weight: 700;
      }

      > .content {
        > .title-row {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 0.5rem;

          > h2 {
            margin: 0;
            font-size: 0.97rem;
            color: rgba($secondary-text, 0.92);
            line-height: 1.25;
          }

          > .state-chip {
            border-radius: borders.$rounded;
            border: 1px solid rgba($secondary, 0.2);
            background: rgba($secondary, 0.05);
            color: rgba($secondary-text, 0.72);
            font-size: 0.72rem;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            padding: 0.2rem 0.52rem;
            white-space: nowrap;
          }
        }

        > p {
          margin: 0.32rem 0 0;
          color: rgba($secondary-text, 0.7);
          font-size: 0.89rem;
          line-height: 1.42;
        }
      }

      &.is-done {
        border-color: rgba($secondary, 0.26);
        background: linear-gradient(140deg, rgba($secondary, 0.08), rgba($accent, 0.92));

        > .step-index {
          border-color: rgba($secondary, 0.58);
          background: rgba($secondary, 0.88);
          color: rgba($accent, 1);
        }

        .state-chip {
          border-color: rgba($secondary, 0.58);
          background: rgba($secondary, 0.9);
          color: rgba($accent, 1);
        }
      }

      &.is-active {
        border-color: rgba($secondary, 0.3);
        background: rgba($secondary, 0.06);

        > .step-index {
          border-color: rgba($secondary, 0.58);
          background: rgba($secondary, 0.14);
          color: rgba($secondary, 0.94);
        }

        .state-chip {
          border-color: rgba($secondary, 0.3);
          background: rgba($secondary, 0.14);
          color: rgba($secondary, 0.9);
        }
      }

      &.is-upcoming {
        opacity: 0.78;

        > .step-index {
          border-style: dashed;
        }
      }
    }
  }

  .next-step-card {
    border-radius: 1rem;
    border: 1px solid rgba($secondary, 0.16);
    background: rgba($accent, 0.92);
    padding: 0.88rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;

    > .next-step-eyebrow {
      margin: 0;
      font-size: 0.74rem;
      font-weight: 700;
      letter-spacing: 0.11em;
      text-transform: uppercase;
      color: rgba($secondary, 0.68);
    }

    > h2 {
      margin: 0;
      font-size: 1.1rem;
      color: rgba($secondary-text, 0.93);
      line-height: 1.25;
    }

    > .next-step-detail {
      margin: 0;
      color: rgba($secondary-text, 0.72);
      font-size: 0.92rem;
      line-height: 1.46;
    }

    > .sync-note {
      margin: 0;
      color: rgba($secondary-text, 0.7);
      font-size: 0.82rem;
    }
  }

  .actions-panel {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .action-btn {
    border: 1px solid transparent;
    border-radius: 0.72rem;
    padding: 0.6rem 0.88rem;
    font-size: 0.88rem;
    font-weight: 700;
    cursor: pointer;
    background: rgba($secondary, 0.92);
    color: rgba($accent, 1);
    transition: transform 0.16s ease, opacity 0.16s ease, background-color 0.16s ease;
    min-height: 2.35rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;

    &:hover {
      transform: translateY(-1px);
    }

    &:disabled {
      opacity: 0.58;
      cursor: not-allowed;
      transform: none;
    }

    &.ghost {
      background: rgba($secondary, 0.06);
      color: rgba($secondary-text, 0.87);
      border-color: rgba($secondary, 0.22);
    }
  }

  .dev-console {
    border-radius: 1rem;
    border: 1px solid rgba($secondary, 0.2);
    background: rgba($secondary, 0.95);
    color: rgba($accent, 0.92);
    padding: 0.76rem 0.82rem;
    display: flex;
    flex-direction: column;
    gap: 0.58rem;

    > .dev-console-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.7rem;

      > h2 {
        margin: 0;
        font-size: 0.87rem;
        letter-spacing: 0.03em;
      }
    }

    .dev-console-clear {
      border: 1px solid rgba($accent, 0.3);
      border-radius: 0.55rem;
      padding: 0.34rem 0.62rem;
      font-size: 0.78rem;
      font-weight: 600;
      color: rgba($accent, 0.96);
      background: rgba($accent, 0.08);
      transition: opacity 0.16s ease;
      cursor: pointer;

      &:disabled {
        opacity: 0.44;
        cursor: not-allowed;
      }
    }

    .dev-console-empty {
      margin: 0;
      color: rgba($accent, 0.72);
      font-size: 0.82rem;
    }

    .dev-console-list {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 0.4rem;
      max-height: 12.8rem;
      overflow: auto;
    }

    .dev-console-item {
      margin: 0;
      display: grid;
      grid-template-columns: auto auto 1fr;
      gap: 0.55rem;
      align-items: start;
      padding: 0.44rem 0.5rem;
      border-radius: 0.62rem;
      background: rgba($accent, 0.06);
      border: 1px solid rgba($accent, 0.14);
      font-size: 0.78rem;
      line-height: 1.35;

      > .time {
        color: rgba($accent, 0.72);
        font-variant-numeric: tabular-nums;
      }

      > .level {
        color: rgba($accent, 0.78);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        font-weight: 700;
      }

      > .message {
        color: rgba($accent, 0.9);
      }

      &.is-error {
        border-color: rgba($accent, 0.3);
        background: rgba($accent, 0.11);
      }
    }
  }

  @media (max-width: 760px) {
    > .checklist-shell {
      padding: 0.92rem;
      gap: 0.8rem;
    }

    .checklist-items > .checklist-item {
      padding: 0.66rem;
      gap: 0.58rem;
    }

    .actions-panel {
      flex-direction: column;
    }

    .action-btn {
      width: 100%;
    }

    .dev-console-item {
      grid-template-columns: 1fr;
      gap: 0.25rem;
    }
  }

  @media (max-width: 520px) {
    padding-top: clamp(5rem, 12vw, 5.8rem);

    .checklist-header > h1 {
      font-size: clamp(1.3rem, 6vw, 1.58rem);
    }

    .progress-panel .progress-value {
      font-size: 0.76rem;
    }

    .checklist-items > .checklist-item > .content > .title-row {
      align-items: flex-start;
    }

    .checklist-items > .checklist-item > .content > .title-row > .state-chip {
      font-size: 0.68rem;
    }
  }
}
</style>
