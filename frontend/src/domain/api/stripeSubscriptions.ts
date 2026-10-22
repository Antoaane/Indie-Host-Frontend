// File: src/domain/api/stripeSubscriptions.ts

import clerkToken from '@/utils/clerkToken'

export type SubscriptionPlanCode = 'indiehost' | 'superhost'

export type StripeSubscriptionPlan = {
  code: SubscriptionPlanCode
  name: string
  description: string
  maxActiveListings: number
  currency: string
  monthlyPriceMinor: number
  billingInterval: string
  stripePriceId: string | null
  available: boolean
  unavailableReason: string | null
}

export type StripeExtraListingOffer = {
  code: 'extra_listing'
  name: string
  description: string
  currency: string
  monthlyPriceMinor: number
  billingInterval: string
  stripePriceId: string | null
  available: boolean
  unavailableReason: string | null
}

export type StripeListingAllowance = {
  includedListings: number
  extraListings: number
  /** null = illimité (super admin). */
  maxActiveListings: number | null
  activeListings: number
  remaining: number | null
}

export type StripeSubscriptionSnapshot = {
  subscriptionId: string | null
  planCode: SubscriptionPlanCode | null
  status: string | null
  currentPeriodEndISO: string | null
  cancelAtPeriodEnd: boolean
  updatedAtISO: string | null
  pendingPlanCode: SubscriptionPlanCode | null
  pendingCheckoutSessionId: string | null
  includedListings: number | null
  extraListings: number
  /** Plan offert par IndieHost : actif sans abonnement Stripe. */
  complimentary: boolean
  complimentaryEndsAtISO: string | null
}

export type UpdateExtraListingsResponse = {
  state: 'updated' | 'subscription_required' | 'offer_unavailable' | 'quantity_in_use'
  mode: 'live' | 'mock'
  subscription: StripeSubscriptionSnapshot | null
  listingAllowance: StripeListingAllowance
  message: string | null
}

export type StripeConnectSummary = {
  accountId: string | null
  onboardingStatus: string
  chargesEnabled: boolean
  payoutsEnabled: boolean
  defaultCurrency: string
  transferSchedule: string
  createdInFlow?: boolean
}

export type StripePublicationReadiness = {
  canPublish: boolean
  hasActiveSubscription: boolean
  hasConnectAccount: boolean
  connectOnboardingCompleted: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
  missingRequirements: string[]
}

export type StripeSubscriptionState = {
  mode: 'live' | 'mock'
  plans: StripeSubscriptionPlan[]
  extraListing: StripeExtraListingOffer | null
  currentPlanCode: SubscriptionPlanCode | null
  currentPlan: StripeSubscriptionPlan | null
  subscription: StripeSubscriptionSnapshot | null
  listingAllowance: StripeListingAllowance
  connect: StripeConnectSummary
  publicationReadiness: StripePublicationReadiness
}

export type StripeSubscriptionCatalog = {
  plans: StripeSubscriptionPlan[]
  extraListing: StripeExtraListingOffer | null
}

export type ActivateSubscriptionResponse = {
  state: 'plan_unavailable' | 'checkout_required' | 'updated' | 'already_active'
  mode: 'live' | 'mock'
  plan: StripeSubscriptionPlan | null
  subscription: StripeSubscriptionSnapshot | null
  connect: StripeConnectSummary
  publicationReadiness: StripePublicationReadiness
  checkout: {
    sessionId: string
    url: string
  } | null
  message: string | null
}

export type ConfirmSubscriptionCheckoutResponse = {
  state: 'confirmed' | 'not_found'
  mode: 'live' | 'mock'
  plan: StripeSubscriptionPlan | null
  subscription: StripeSubscriptionSnapshot | null
  connect: StripeConnectSummary
  publicationReadiness: StripePublicationReadiness
  message: string | null
}

export type StripeConnectOnboardingLinkResponse = {
  accountId: string
  url: string
  expiresAt?: number
  mode: 'live' | 'mock'
}

export type StripeConnectDashboardLinkResponse = {
  accountId: string
  url: string
  mode: 'live' | 'mock'
}

export type StripeConnectSyncResponse = {
  mode: 'live' | 'mock'
  connect: StripeConnectSummary
  publicationReadiness: StripePublicationReadiness
}

type ParsedEndpoint = {
  origin?: string
  path?: string
}

const RAW_STRIPE_API_BASE_URL = (import.meta.env.VITE_STRIPE_API_BASE_URL ?? import.meta.env.VITE_API_BASE_URL ?? '').trim()
const BASE_API_URL = normalizeApiBaseUrl(RAW_STRIPE_API_BASE_URL)

const PLANS_PATH = '/payments/stripe/subscriptions/plans'
const STATE_PATH = '/payments/stripe/subscriptions/me'
const ACTIVATE_PATH = '/payments/stripe/subscriptions/activate'
const CONFIRM_CHECKOUT_PATH = '/payments/stripe/subscriptions/checkout/confirm'
const CONNECT_ONBOARDING_LINK_PATH = '/payments/stripe/connect/onboarding-link'
const CONNECT_DASHBOARD_LINK_PATH = '/payments/stripe/connect/dashboard-link'
const CONNECT_SYNC_PATH = '/payments/stripe/connect/sync'

function normalizePath(path: string): string {
  const trimmed = path.trim()
  if (!trimmed) return '/'
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function normalizePathPrefix(rawPath: string): string {
  const trimmed = rawPath.trim()
  if (!trimmed) return '/'
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  const noTrailingSlash = withLeadingSlash.replace(/\/+$/, '')
  return noTrailingSlash || '/'
}

function parseEndpoint(raw: string): ParsedEndpoint {
  const trimmed = raw.trim()
  if (!trimmed) return {}

  try {
    const parsed = new URL(trimmed)
    return {
      origin: parsed.origin,
      path: normalizePathPrefix(parsed.pathname),
    }
  } catch {
    if (trimmed.startsWith('/')) return { path: normalizePathPrefix(trimmed) }
    return {}
  }
}

function normalizeApiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/$/, '')
  if (!trimmed) return ''
  return trimmed
}

function joinUrl(base: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const normalizedBase = base.replace(/\/+$/, '')
  if (!normalizedBase) return normalizedPath
  return `${normalizedBase}${normalizedPath}`
}

function resolveUrl(url: string): string {
  if (typeof window === 'undefined') return url
  return new URL(url, window.location.origin).toString()
}

function buildApiUrl(path: string): string {
  const normalizedPath = normalizePath(path)
  if (/^https?:\/\//i.test(normalizedPath)) return normalizedPath

  const parsedBase = parseEndpoint(BASE_API_URL)
  if (parsedBase.origin) {
    const originWithPath = joinUrl(parsedBase.origin, parsedBase.path ?? '/')
    return joinUrl(originWithPath, normalizedPath)
  }
  if (parsedBase.path) return joinUrl(parsedBase.path, normalizedPath)
  if (!BASE_API_URL) return normalizedPath
  return joinUrl(BASE_API_URL, normalizedPath)
}

function waitForClerkToken({ timeoutMs, pollEveryMs }: { timeoutMs: number; pollEveryMs: number }): Promise<string | null> {
  const startedAt = Date.now()

  return new Promise((resolve) => {
    const tick = () => {
      const token = (clerkToken.value ?? '').trim()
      if (token) return resolve(token)
      if (Date.now() - startedAt >= timeoutMs) return resolve(null)
      setTimeout(tick, pollEveryMs)
    }

    tick()
  })
}

async function getAxios() {
  const { default: axios } = await import('axios')
  return axios
}

// Jeton frais depuis le runtime Clerk (quand le store n'a pas encore été alimenté par la navigation).
async function readFreshTokenFromClerkRuntime(): Promise<string | null> {
  if (typeof window === 'undefined') return null

  const clerk = (window as Window & {
    Clerk?: { session?: { getToken?: () => Promise<string | null> } }
  }).Clerk
  const getSessionToken = clerk?.session?.getToken
  if (typeof getSessionToken !== 'function') return null

  try {
    const token = (await getSessionToken())?.trim() ?? ''
    if (!token) return null
    clerkToken.value = token
    return token
  } catch {
    return null
  }
}

async function getAuthToken(): Promise<string | null> {
  const token = (clerkToken.value ?? '').trim()
  if (token) return token

  const fresh = await readFreshTokenFromClerkRuntime()
  if (fresh) return fresh

  return waitForClerkToken({ timeoutMs: 2500, pollEveryMs: 60 })
}

function toApiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const response = (error as { response?: { data?: { message?: unknown } } }).response
    const responseMessage = response?.data?.message
    if (typeof responseMessage === 'string' && responseMessage.trim()) return responseMessage.trim()

    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message.trim()
  }

  return fallback
}

async function getHeaders({ requiresAuth }: { requiresAuth: boolean }) {
  const token = await getAuthToken()

  if (requiresAuth && !token) {
    throw new Error('Session utilisateur absente. Veuillez vous reconnecter.')
  }

  return token
    ? { Authorization: `Bearer ${token}` }
    : undefined
}

export async function fetchStripeSubscriptionPlans(): Promise<StripeSubscriptionPlan[]> {
  const axios = await getAxios()

  try {
    const { data } = await axios.get<{ plans?: StripeSubscriptionPlan[] }>(resolveUrl(buildApiUrl(PLANS_PATH)), {
      withCredentials: false,
    })

    return Array.isArray(data?.plans) ? data.plans : []
  } catch (error) {
    throw new Error(toApiErrorMessage(error, 'Impossible de charger les plans.'))
  }
}

export async function fetchMyStripeSubscriptionState({ sync = false }: { sync?: boolean } = {}): Promise<StripeSubscriptionState> {
  const axios = await getAxios()
  const headers = await getHeaders({ requiresAuth: true })

  try {
    const { data } = await axios.get<StripeSubscriptionState>(resolveUrl(buildApiUrl(STATE_PATH)), {
      withCredentials: false,
      headers,
      params: { sync: sync ? '1' : '0' },
    })

    return data
  } catch (error) {
    throw new Error(toApiErrorMessage(error, 'Impossible de charger votre abonnement.'))
  }
}

export async function fetchStripeSubscriptionCatalog(): Promise<StripeSubscriptionCatalog> {
  const axios = await getAxios()

  try {
    const { data } = await axios.get<Partial<StripeSubscriptionCatalog>>(resolveUrl(buildApiUrl('/payments/stripe/subscriptions/catalog')), {
      withCredentials: false,
    })

    return {
      plans: Array.isArray(data?.plans) ? data.plans : [],
      extraListing: data?.extraListing ?? null,
    }
  } catch (error) {
    throw new Error(toApiErrorMessage(error, 'Impossible de charger le catalogue des offres.'))
  }
}

/** Ajuste le nombre de logements supplémentaires (12 €/mois chacun) sur l'abonnement courant. */
export async function updateMyExtraListings(quantity: number): Promise<UpdateExtraListingsResponse> {
  const axios = await getAxios()
  const headers = await getHeaders({ requiresAuth: true })

  try {
    const { data } = await axios.post<UpdateExtraListingsResponse>(
      resolveUrl(buildApiUrl('/payments/stripe/subscriptions/extra-listings')),
      { quantity: Math.max(0, Math.trunc(quantity)) },
      {
        withCredentials: false,
        headers,
      },
    )

    return data
  } catch (error) {
    throw new Error(toApiErrorMessage(error, 'Impossible de modifier vos logements supplémentaires.'))
  }
}

/**
 * Résiliation depuis le compte (`true`) ou reprise avant la fin de période (`false`).
 * L'abonnement reste actif jusqu'à la fin de la période payée ; aucun remboursement n'est émis.
 */
export async function setMySubscriptionCancellation(cancelAtPeriodEnd: boolean): Promise<StripeSubscriptionState> {
  const axios = await getAxios()
  const headers = await getHeaders({ requiresAuth: true })

  try {
    const { data } = await axios.post<StripeSubscriptionState>(
      resolveUrl(buildApiUrl('/payments/stripe/subscriptions/cancellation')),
      { cancelAtPeriodEnd },
      {
        withCredentials: false,
        headers,
      },
    )

    return data
  } catch (error) {
    throw new Error(toApiErrorMessage(error, cancelAtPeriodEnd
      ? 'Impossible de résilier votre abonnement pour le moment.'
      : 'Impossible de reprendre votre abonnement pour le moment.'))
  }
}

export type AdminSubscriptionLinkResponse = {
  state: 'created' | 'plan_unavailable'
  mode: 'live' | 'mock'
  plan: StripeSubscriptionPlan | null
  url: string | null
  sessionId: string | null
  expiresAtISO: string | null
  message: string | null
}

/** État d'abonnement d'un client, pour la fenêtre admin. */
export async function fetchAdminUserSubscriptionState(userId: string, { sync = false }: { sync?: boolean } = {}): Promise<StripeSubscriptionState> {
  const axios = await getAxios()
  const headers = await getHeaders({ requiresAuth: true })

  try {
    const { data } = await axios.get<StripeSubscriptionState>(
      resolveUrl(buildApiUrl(`/payments/stripe/admin/users/${encodeURIComponent(userId.trim())}/subscription`)),
      {
        withCredentials: false,
        headers,
        params: { sync: sync ? '1' : '0' },
      },
    )

    return data
  } catch (error) {
    throw new Error(toApiErrorMessage(error, 'Impossible de charger l’abonnement de ce client.'))
  }
}

/** Ajuste les logements supplémentaires d'un client (admin). */
export async function updateAdminUserExtraListings(userId: string, quantity: number): Promise<UpdateExtraListingsResponse> {
  const axios = await getAxios()
  const headers = await getHeaders({ requiresAuth: true })

  try {
    const { data } = await axios.post<UpdateExtraListingsResponse>(
      resolveUrl(buildApiUrl(`/payments/stripe/admin/users/${encodeURIComponent(userId.trim())}/extra-listings`)),
      { quantity: Math.max(0, Math.trunc(quantity)) },
      {
        withCredentials: false,
        headers,
      },
    )

    return data
  } catch (error) {
    throw new Error(toApiErrorMessage(error, 'Impossible de modifier les logements supplémentaires de ce client.'))
  }
}

export type AdminComplimentaryPlanResponse = {
  state: 'granted' | 'revoked' | 'subscription_exists' | 'plan_unavailable'
  subscriptionState: StripeSubscriptionState
  message: string | null
}

/** Offre un plan à un client (actif sans Stripe, illimité ou jusqu'à une date). */
export async function grantAdminComplimentaryPlan(userId: string, input: {
  planCode: SubscriptionPlanCode
  extraListings?: number
  endsAtISO?: string | null
}): Promise<AdminComplimentaryPlanResponse> {
  const axios = await getAxios()
  const headers = await getHeaders({ requiresAuth: true })

  try {
    const { data } = await axios.post<AdminComplimentaryPlanResponse>(
      resolveUrl(buildApiUrl(`/payments/stripe/admin/users/${encodeURIComponent(userId.trim())}/complimentary-plan`)),
      {
        planCode: input.planCode,
        extraListings: Math.max(0, Math.trunc(input.extraListings ?? 0)),
        ...(input.endsAtISO ? { endsAtISO: input.endsAtISO } : {}),
      },
      {
        withCredentials: false,
        headers,
      },
    )

    return data
  } catch (error) {
    throw new Error(toApiErrorMessage(error, 'Impossible d’offrir ce plan.'))
  }
}

/** Retire le plan offert d'un client (ses annonces en ligne sont gelées). */
export async function revokeAdminComplimentaryPlan(userId: string): Promise<AdminComplimentaryPlanResponse> {
  const axios = await getAxios()
  const headers = await getHeaders({ requiresAuth: true })

  try {
    const { data } = await axios.delete<AdminComplimentaryPlanResponse>(
      resolveUrl(buildApiUrl(`/payments/stripe/admin/users/${encodeURIComponent(userId.trim())}/complimentary-plan`)),
      {
        withCredentials: false,
        headers,
      },
    )

    return data
  } catch (error) {
    throw new Error(toApiErrorMessage(error, 'Impossible de retirer le plan offert.'))
  }
}

/** Génère un lien de paiement Stripe (abonnement) à envoyer à un client. */
export async function createAdminSubscriptionLink(input: {
  userId: string
  planCode: SubscriptionPlanCode
  extraListings?: number
  successUrl: string
  cancelUrl: string
}): Promise<AdminSubscriptionLinkResponse> {
  const axios = await getAxios()
  const headers = await getHeaders({ requiresAuth: true })

  try {
    const { data } = await axios.post<AdminSubscriptionLinkResponse>(
      resolveUrl(buildApiUrl('/payments/stripe/admin/subscription-links')),
      {
        userId: input.userId.trim(),
        planCode: input.planCode,
        extraListings: Math.max(0, Math.trunc(input.extraListings ?? 0)),
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
      },
      {
        withCredentials: false,
        headers,
      },
    )

    return data
  } catch (error) {
    throw new Error(toApiErrorMessage(error, 'Impossible de générer le lien d’abonnement.'))
  }
}

export async function activateStripeSubscriptionPlan(input: {
  planCode: SubscriptionPlanCode
  successUrl: string
  cancelUrl: string
}): Promise<ActivateSubscriptionResponse> {
  const axios = await getAxios()
  const headers = await getHeaders({ requiresAuth: true })

  try {
    const { data } = await axios.post<ActivateSubscriptionResponse>(
      resolveUrl(buildApiUrl(ACTIVATE_PATH)),
      {
        planCode: input.planCode,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
      },
      {
        withCredentials: false,
        headers,
      },
    )

    return data
  } catch (error) {
    throw new Error(toApiErrorMessage(error, 'Impossible de lancer l’activation du plan.'))
  }
}

export async function confirmStripeSubscriptionCheckout(input: {
  sessionId: string
  planCode?: SubscriptionPlanCode
}): Promise<ConfirmSubscriptionCheckoutResponse> {
  const axios = await getAxios()
  const headers = await getHeaders({ requiresAuth: true })

  try {
    const { data } = await axios.post<ConfirmSubscriptionCheckoutResponse>(
      resolveUrl(buildApiUrl(CONFIRM_CHECKOUT_PATH)),
      {
        sessionId: input.sessionId,
        planCode: input.planCode,
      },
      {
        withCredentials: false,
        headers,
      },
    )

    return data
  } catch (error) {
    throw new Error(toApiErrorMessage(error, 'Impossible de confirmer le paiement Stripe.'))
  }
}

export async function createStripeConnectOnboardingLink(input: {
  accountId?: string
  refreshUrl: string
  returnUrl: string
  country?: string
}): Promise<StripeConnectOnboardingLinkResponse> {
  const axios = await getAxios()
  const headers = await getHeaders({ requiresAuth: true })

  try {
    const { data } = await axios.post<StripeConnectOnboardingLinkResponse>(
      resolveUrl(buildApiUrl(CONNECT_ONBOARDING_LINK_PATH)),
      {
        accountId: input.accountId,
        refreshUrl: input.refreshUrl,
        returnUrl: input.returnUrl,
        country: input.country ?? 'FR',
      },
      {
        withCredentials: false,
        headers,
      },
    )
    return data
  } catch (error) {
    throw new Error(toApiErrorMessage(error, 'Impossible de lancer la configuration Stripe Connect.'))
  }
}

export async function createMyStripeConnectDashboardLink(input?: { accountId?: string }): Promise<StripeConnectDashboardLinkResponse> {
  const axios = await getAxios()
  const headers = await getHeaders({ requiresAuth: true })

  try {
    const { data } = await axios.post<StripeConnectDashboardLinkResponse>(
      resolveUrl(buildApiUrl(CONNECT_DASHBOARD_LINK_PATH)),
      {
        accountId: input?.accountId,
      },
      {
        withCredentials: false,
        headers,
      },
    )

    return data
  } catch (error) {
    throw new Error(toApiErrorMessage(error, 'Impossible de créer un lien vers le dashboard Stripe Connect.'))
  }
}

export async function syncMyStripeConnectState(input?: { accountId?: string }): Promise<StripeConnectSyncResponse> {
  const axios = await getAxios()
  const headers = await getHeaders({ requiresAuth: true })

  try {
    const { data } = await axios.post<StripeConnectSyncResponse>(
      resolveUrl(buildApiUrl(CONNECT_SYNC_PATH)),
      {
        accountId: input?.accountId,
      },
      {
        withCredentials: false,
        headers,
      },
    )

    return data
  } catch (error) {
    throw new Error(toApiErrorMessage(error, 'Impossible de synchroniser Stripe Connect.'))
  }
}
