<!-- File: src/views/Admin/_Admin.vue -->

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Check, Copy, Gift, Link2, Mail, Minus, Plus, RefreshCw, Search, UserPlus } from 'lucide-vue-next'

import { useAdminAccess } from '@/composables/useAdminAccess'
import {
  createAdminSubscriptionLink,
  fetchAdminUserSubscriptionState,
  grantAdminComplimentaryPlan,
  revokeAdminComplimentaryPlan,
  updateAdminUserExtraListings,
  type StripeSubscriptionState,
  type SubscriptionPlanCode,
} from '@/domain/api/stripeSubscriptions'
import { createAdminInvitation, fetchAdminUsersOverview, type AdminUserOverview } from '@/domain/api/users'
import { formatExtraListingPrice, getMarketingPricingPlan } from '@/domain/payments/pricingPlanCatalog'
import { readActiveUserId } from '@/router/backOfficeUser'

const route = useRoute()
const router = useRouter()
const { isAdminUser, apiAdminAccess } = useAdminAccess()

const PLAN_CODES: SubscriptionPlanCode[] = ['indiehost', 'superhost']

const isAccessResolved = computed(() => apiAdminAccess.value !== null || isAdminUser.value)

// --- Clients ---------------------------------------------------------------
const users = ref<AdminUserOverview[]>([])
const isLoadingUsers = ref(false)
const usersError = ref<string | null>(null)
const query = ref('')
const selectedKey = ref<string | null>(null)

const filteredUsers = computed(() => {
  const needle = normalizeSearch(query.value)
  if (!needle) return users.value
  return users.value.filter((user) => normalizeSearch([
    user.firstName ?? '',
    user.lastName ?? '',
    user.displayName ?? '',
    user.email ?? '',
    user.clerkUserId ?? '',
  ].join(' ')).includes(needle))
})

const selectedUser = computed(() => users.value.find((user) => userKey(user) === selectedKey.value) ?? null)
const selectedUserId = computed(() => selectedUser.value?.id ?? null)

// --- Invitation ------------------------------------------------------------
const inviteEmail = ref('')
const inviteFirstName = ref('')
const inviteLastName = ref('')
const isInviting = ref(false)
const inviteError = ref<string | null>(null)
const inviteSuccess = ref<string | null>(null)

// --- Abonnement du client sélectionné ---------------------------------------
const subscriptionState = ref<StripeSubscriptionState | null>(null)
const isLoadingSubscription = ref(false)
const subscriptionError = ref<string | null>(null)
const extraDraft = ref(0)
const isSavingExtra = ref(false)
const extraMessage = ref<string | null>(null)
const extraError = ref<string | null>(null)

// --- Plan offert (sans Stripe) ---------------------------------------------
const giftPlanCode = ref<SubscriptionPlanCode>('indiehost')
const giftExtraListings = ref(0)
const giftEndsAt = ref('')
const isGranting = ref(false)
const giftError = ref<string | null>(null)
const giftMessage = ref<string | null>(null)
const isRevoking = ref(false)
const isRevokeArmed = ref(false)

const isComplimentary = computed(() => Boolean(subscriptionState.value?.subscription?.complimentary))
const subscriptionStatusLabel = computed(() => {
  const snapshot = subscriptionState.value?.subscription ?? null
  if (snapshot?.complimentary) {
    return snapshot.complimentaryEndsAtISO
      ? `Offert jusqu’au ${formatDate(snapshot.complimentaryEndsAtISO)}`
      : 'Offert par IndieHost'
  }
  return statusLabel(snapshot?.status ?? null, subscriptionState.value?.currentPlanCode ?? null)
})

// --- Lien d'abonnement -----------------------------------------------------
const linkPlanCode = ref<SubscriptionPlanCode>('indiehost')
const linkExtraListings = ref(0)
const isGeneratingLink = ref(false)
const linkError = ref<string | null>(null)
const generatedLink = ref<{ url: string; expiresAtISO: string | null; message: string | null } | null>(null)
const hasCopiedLink = ref(false)

const extraListingPrice = computed(() => formatExtraListingPrice(subscriptionState.value?.extraListing))
const currentExtraListings = computed(() => subscriptionState.value?.listingAllowance.extraListings ?? 0)
const isExtraDirty = computed(() => extraDraft.value !== currentExtraListings.value)
const isSubscriptionActive = computed(() => {
  const status = (subscriptionState.value?.subscription?.status ?? '').toLowerCase()
  return status === 'active' || status === 'trialing'
})

const linkMailto = computed(() => {
  const user = selectedUser.value
  const link = generatedLink.value
  if (!user?.email || !link) return null
  const plan = getMarketingPricingPlan(linkPlanCode.value)
  const subject = `Votre abonnement ${plan.name} IndieHost`
  const body = [
    `Bonjour${user.firstName ? ` ${user.firstName}` : ''},`,
    '',
    `Voici votre lien pour activer l’abonnement ${plan.name} (${plan.displayPrice}${linkExtraListings.value ? `, + ${linkExtraListings.value} logement${linkExtraListings.value > 1 ? 's' : ''} supplémentaire${linkExtraListings.value > 1 ? 's' : ''}` : ''}) :`,
    link.url,
    '',
    'Le lien est valable 24 heures. Votre essai gratuit de 30 jours démarre à l’activation.',
    '',
    'À bientôt,',
    'L’équipe IndieHost',
  ].join('\n')
  return `mailto:${encodeURIComponent(user.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
})

function normalizeSearch(value: string): string {
  return value.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function userKey(user: AdminUserOverview): string {
  return user.id ?? `clerk:${user.clerkUserId ?? user.email ?? ''}`
}

function userLabel(user: AdminUserOverview): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return user.displayName || fullName || user.email || 'Client sans nom'
}

function userInitials(user: AdminUserOverview): string {
  const label = userLabel(user)
  const parts = label.split(/[\s@._-]+/).filter(Boolean)
  return (parts.slice(0, 2).map((part) => part[0] ?? '').join('') || '?').toUpperCase()
}

function statusLabel(status: string | null, planCode: string | null): string {
  if (!planCode && !status) return 'Sans abonnement'
  switch ((status ?? '').toLowerCase()) {
    case 'trialing': return 'Essai gratuit'
    case 'active': return 'Actif'
    case 'past_due': return 'Paiement en retard'
    case 'unpaid': return 'Impayé'
    case 'incomplete': return 'Paiement incomplet'
    case 'canceled': return 'Résilié'
    default: return status ? status : 'Sans abonnement'
  }
}

function statusTone(status: string | null): 'good' | 'warn' | 'bad' | 'muted' {
  switch ((status ?? '').toLowerCase()) {
    case 'active':
    case 'trialing':
      return 'good'
    case 'past_due':
    case 'incomplete':
      return 'warn'
    case 'unpaid':
    case 'canceled':
      return 'bad'
    default:
      return 'muted'
  }
}

function planLabel(planCode: string | null): string {
  if (planCode === 'indiehost' || planCode === 'superhost') return getMarketingPricingPlan(planCode).name
  return 'Aucun plan'
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message.trim()
  }
  return fallback
}

function buildAppUrl(path: string): string {
  if (typeof window === 'undefined') return path
  return new URL(path, window.location.origin).toString()
}

// --- Chargements -----------------------------------------------------------
async function loadUsers() {
  isLoadingUsers.value = true
  usersError.value = null
  try {
    users.value = await fetchAdminUsersOverview()
    const requested = readActiveUserId(route.params.userId) ?? readQueryValue(route.query.userId)
    if (requested) {
      const match = users.value.find((user) => user.id === requested || user.clerkUserId === requested)
      if (match) selectedKey.value = userKey(match)
    }
  } catch (error) {
    usersError.value = resolveErrorMessage(error, 'Impossible de charger les clients.')
  } finally {
    isLoadingUsers.value = false
  }
}

function readQueryValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) return value[0].trim()
  return null
}

async function loadSubscription(userId: string, options?: { sync?: boolean }) {
  isLoadingSubscription.value = true
  subscriptionError.value = null
  try {
    subscriptionState.value = await fetchAdminUserSubscriptionState(userId, { sync: options?.sync })
    extraDraft.value = subscriptionState.value.listingAllowance.extraListings
  } catch (error) {
    subscriptionState.value = null
    subscriptionError.value = resolveErrorMessage(error, 'Impossible de charger l’abonnement.')
  } finally {
    isLoadingSubscription.value = false
  }
}

function selectUser(user: AdminUserOverview) {
  selectedKey.value = userKey(user)
  generatedLink.value = null
  linkError.value = null
  extraMessage.value = null
  extraError.value = null
  hasCopiedLink.value = false
  const nextQuery = { ...route.query }
  if (user.id) nextQuery.userId = user.id
  else delete nextQuery.userId
  void router.replace({ query: nextQuery })
}

// --- Actions ---------------------------------------------------------------
async function submitInvitation() {
  if (isInviting.value) return
  inviteError.value = null
  inviteSuccess.value = null

  const email = inviteEmail.value.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    inviteError.value = 'Saisissez une adresse email valide.'
    return
  }

  isInviting.value = true
  try {
    const invitation = await createAdminInvitation({
      email,
      firstName: inviteFirstName.value,
      lastName: inviteLastName.value,
      redirectUrl: buildAppUrl('/sign-up'),
    })
    inviteSuccess.value = `Invitation envoyée à ${invitation.emailAddress}. Le client recevra un email pour créer son compte ; il apparaîtra ici dès son inscription.`
    inviteEmail.value = ''
    inviteFirstName.value = ''
    inviteLastName.value = ''
    void loadUsers()
  } catch (error) {
    inviteError.value = resolveErrorMessage(error, 'Impossible d’envoyer l’invitation.')
  } finally {
    isInviting.value = false
  }
}

async function saveExtraListings() {
  const userId = selectedUserId.value
  if (!userId || isSavingExtra.value || !isExtraDirty.value) return
  extraError.value = null
  extraMessage.value = null
  isSavingExtra.value = true
  try {
    const result = await updateAdminUserExtraListings(userId, extraDraft.value)
    if (result.state !== 'updated') {
      extraError.value = result.message ?? 'Modification refusée.'
      extraDraft.value = currentExtraListings.value
      return
    }
    extraMessage.value = `Logements supplémentaires : ${result.listingAllowance.extraListings}. Facturation ajustée au prorata.`
    await loadSubscription(userId)
    void loadUsers()
  } catch (error) {
    extraError.value = resolveErrorMessage(error, 'Impossible de modifier les logements supplémentaires.')
  } finally {
    isSavingExtra.value = false
  }
}

async function generateLink() {
  const userId = selectedUserId.value
  if (!userId || isGeneratingLink.value) return
  linkError.value = null
  generatedLink.value = null
  hasCopiedLink.value = false
  isGeneratingLink.value = true
  try {
    const result = await createAdminSubscriptionLink({
      userId,
      planCode: linkPlanCode.value,
      extraListings: linkExtraListings.value,
      successUrl: buildAppUrl(`/pricing/callback?plan=${encodeURIComponent(linkPlanCode.value)}&action=checkout`),
      cancelUrl: buildAppUrl('/pricing'),
    })
    if (result.state !== 'created' || !result.url) {
      linkError.value = result.message ?? 'Plan indisponible.'
      return
    }
    generatedLink.value = { url: result.url, expiresAtISO: result.expiresAtISO, message: result.message }
  } catch (error) {
    linkError.value = resolveErrorMessage(error, 'Impossible de générer le lien.')
  } finally {
    isGeneratingLink.value = false
  }
}

async function copyLink() {
  const url = generatedLink.value?.url
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    hasCopiedLink.value = true
    setTimeout(() => { hasCopiedLink.value = false }, 2500)
  } catch {
    hasCopiedLink.value = false
  }
}

async function grantGift() {
  const userId = selectedUserId.value
  if (!userId || isGranting.value) return
  giftError.value = null
  giftMessage.value = null

  let endsAtISO: string | null = null
  if (giftEndsAt.value) {
    const endsAt = new Date(`${giftEndsAt.value}T23:59:59`)
    if (Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= Date.now()) {
      giftError.value = 'La date de fin doit être dans le futur.'
      return
    }
    endsAtISO = endsAt.toISOString()
  }

  isGranting.value = true
  try {
    const result = await grantAdminComplimentaryPlan(userId, {
      planCode: giftPlanCode.value,
      extraListings: giftExtraListings.value,
      endsAtISO,
    })
    if (result.state !== 'granted') {
      giftError.value = result.message ?? 'Impossible d’offrir ce plan.'
      return
    }
    subscriptionState.value = result.subscriptionState
    extraDraft.value = result.subscriptionState.listingAllowance.extraListings
    giftMessage.value = `Plan ${getMarketingPricingPlan(giftPlanCode.value).name} offert${endsAtISO ? ` jusqu’au ${formatDate(endsAtISO)}` : ', sans limite de durée'}. Vous pouvez créer et publier ses annonces depuis « Ses annonces ».`
    void loadUsers()
  } catch (error) {
    giftError.value = resolveErrorMessage(error, 'Impossible d’offrir ce plan.')
  } finally {
    isGranting.value = false
  }
}

async function revokeGift() {
  const userId = selectedUserId.value
  if (!userId || isRevoking.value) return
  if (!isRevokeArmed.value) {
    isRevokeArmed.value = true
    return
  }

  giftError.value = null
  giftMessage.value = null
  isRevoking.value = true
  try {
    const result = await revokeAdminComplimentaryPlan(userId)
    subscriptionState.value = result.subscriptionState
    extraDraft.value = result.subscriptionState.listingAllowance.extraListings
    giftMessage.value = 'Plan offert retiré : ses annonces en ligne sont gelées jusqu’à un nouvel abonnement.'
    void loadUsers()
  } catch (error) {
    giftError.value = resolveErrorMessage(error, 'Impossible de retirer le plan offert.')
  } finally {
    isRevoking.value = false
    isRevokeArmed.value = false
  }
}

function adjustGiftExtra(delta: number) {
  giftExtraListings.value = Math.max(0, Math.min(50, giftExtraListings.value + delta))
}

function adjustExtraDraft(delta: number) {
  extraDraft.value = Math.max(0, Math.min(50, extraDraft.value + delta))
}

function adjustLinkExtra(delta: number) {
  linkExtraListings.value = Math.max(0, Math.min(50, linkExtraListings.value + delta))
}

watch(selectedUserId, (userId) => {
  subscriptionState.value = null
  subscriptionError.value = null
  giftError.value = null
  giftMessage.value = null
  isRevokeArmed.value = false
  if (userId) void loadSubscription(userId)
})

watch(isAdminUser, (allowed) => {
  if (allowed && !users.value.length && !isLoadingUsers.value) void loadUsers()
})

onMounted(() => {
  if (isAdminUser.value) void loadUsers()
})
</script>

<template>
  <section class="admin-panel">
    <!-- div et non <header> : l'élément header porte les styles globaux de la barre du site (fixe, flex). -->
    <div class="admin-header">
      <h1>Administration</h1>
      <p>Comptes clients, abonnements et liens de paiement. Vous agissez ici au nom d’IndieHost.</p>
    </div>

    <p
      v-if="isAccessResolved && !isAdminUser"
      class="admin-denied"
      role="alert"
    >
      Cette page est réservée au compte administrateur d’IndieHost.
    </p>

    <div
      v-else
      class="admin-layout"
    >
      <aside class="admin-clients">
        <section class="admin-card admin-invite">
          <h2>Inviter un client</h2>
          <p class="hint">Il reçoit un email Clerk pour créer son compte. Vous pourrez ensuite lui transférer des annonces et lui envoyer son lien d’abonnement.</p>
          <form
            class="invite-form"
            @submit.prevent="submitInvitation"
          >
            <div class="input">
              <input
                v-model="inviteEmail"
                type="email"
                placeholder="email@client.fr"
                autocomplete="off"
                required
              />
            </div>
            <div class="invite-names">
              <div class="input">
                <input
                  v-model="inviteFirstName"
                  type="text"
                  placeholder="Prénom (optionnel)"
                  autocomplete="off"
                />
              </div>
              <div class="input">
                <input
                  v-model="inviteLastName"
                  type="text"
                  placeholder="Nom (optionnel)"
                  autocomplete="off"
                />
              </div>
            </div>
            <div class="action">
              <button
                type="submit"
                :disabled="isInviting"
              >
                <UserPlus :size="16" />
                {{ isInviting ? 'Envoi...' : 'Envoyer l’invitation' }}
              </button>
            </div>
            <p
              v-if="inviteSuccess"
              class="meta is-success"
            >
              {{ inviteSuccess }}
            </p>
            <p
              v-if="inviteError"
              class="meta is-error"
              role="alert"
            >
              {{ inviteError }}
            </p>
          </form>
        </section>

        <section class="admin-card admin-list">
          <div class="list-head">
            <h2>Clients <span class="count">{{ filteredUsers.length }}</span></h2>
            <div class="refresh">
              <button
                type="button"
                :disabled="isLoadingUsers"
                aria-label="Rafraîchir la liste"
                title="Rafraîchir"
                @click="loadUsers"
              >
                <RefreshCw :size="16" />
              </button>
            </div>
          </div>
          <div class="input search">
            <Search
              :size="16"
              aria-hidden="true"
            />
            <input
              v-model="query"
              type="search"
              enterkeyhint="search"
              placeholder="Rechercher un nom, un email…"
              autocomplete="off"
            />
          </div>

          <p
            v-if="isLoadingUsers && !users.length"
            class="meta"
          >
            Chargement des clients...
          </p>
          <p
            v-else-if="usersError"
            class="meta is-error"
            role="alert"
          >
            {{ usersError }}
          </p>
          <p
            v-else-if="!filteredUsers.length"
            class="meta"
          >
            Aucun client ne correspond.
          </p>

          <ul
            v-else
            class="client-list"
          >
            <li
              v-for="user in filteredUsers"
              :key="userKey(user)"
            >
              <button
                type="button"
                class="client"
                :class="{ 'is-selected': userKey(user) === selectedKey }"
                @click="selectUser(user)"
              >
                <span
                  class="avatar"
                  aria-hidden="true"
                >
                  <img
                    v-if="user.avatarUrl"
                    :src="user.avatarUrl"
                    alt=""
                  />
                  <span v-else>{{ userInitials(user) }}</span>
                </span>
                <span class="identity">
                  <strong>{{ userLabel(user) }}</strong>
                  <small>{{ user.email ?? 'Email inconnu' }}</small>
                </span>
                <span class="facts">
                  <span
                    class="badge"
                    :class="`is-${statusTone(user.billing.status)}`"
                  >
                    {{ user.billing.planCode ? planLabel(user.billing.planCode) : 'Sans plan' }}{{ user.billing.complimentary ? ' · offert' : '' }}
                  </span>
                  <small>{{ user.listings.active }} en ligne · {{ user.listings.total }} au total</small>
                </span>
              </button>
            </li>
          </ul>
        </section>
      </aside>

      <section class="admin-detail">
        <div
          v-if="!selectedUser"
          class="admin-card admin-empty"
        >
          <h2>Sélectionnez un client</h2>
          <p class="hint">Son abonnement, ses logements et ses liens de paiement apparaîtront ici.</p>
        </div>

        <template v-else>
          <section class="admin-card detail-head">
            <div class="who">
              <h2>{{ userLabel(selectedUser) }}</h2>
              <p class="hint">{{ selectedUser.email ?? 'Email inconnu' }}</p>
              <dl class="ids">
                <div>
                  <dt>Compte Clerk</dt>
                  <dd><code>{{ selectedUser.clerkUserId ?? '—' }}</code></dd>
                </div>
                <div>
                  <dt>Identifiant IndieHost</dt>
                  <dd><code>{{ selectedUser.id ?? 'pas encore connecté' }}</code></dd>
                </div>
                <div>
                  <dt>Client depuis</dt>
                  <dd>{{ formatDate(selectedUser.createdAtISO) }}</dd>
                </div>
              </dl>
            </div>

            <nav
              v-if="selectedUser.id"
              class="quick-links"
              aria-label="Gérer à la place du client"
            >
              <div class="link"><RouterLink :to="{ name: 'editor-user', params: { userId: selectedUser.id } }">Ses annonces</RouterLink></div>
              <div class="link"><RouterLink :to="{ name: 'management-user', params: { userId: selectedUser.id } }">Ses réservations</RouterLink></div>
              <div class="link"><RouterLink :to="{ name: 'domains-user', params: { userId: selectedUser.id } }">Ses domaines</RouterLink></div>
              <div class="link"><RouterLink :to="{ name: 'messaging-user', params: { userId: selectedUser.id } }">Sa messagerie</RouterLink></div>
            </nav>
            <p
              v-else
              class="meta"
            >
              Ce compte Clerk ne s’est jamais connecté au dashboard : l’abonnement et les annonces seront disponibles après sa première connexion.
            </p>
          </section>

          <section
            v-if="selectedUser.id"
            class="admin-card subscription"
          >
            <div class="card-head">
              <h2>Abonnement</h2>
              <div class="refresh">
                <button
                  type="button"
                  :disabled="isLoadingSubscription"
                  aria-label="Resynchroniser avec Stripe"
                  title="Resynchroniser avec Stripe"
                  @click="loadSubscription(selectedUser.id, { sync: true })"
                >
                  <RefreshCw :size="16" />
                </button>
              </div>
            </div>

            <p
              v-if="isLoadingSubscription && !subscriptionState"
              class="meta"
            >
              Chargement de l’abonnement...
            </p>
            <p
              v-else-if="subscriptionError"
              class="meta is-error"
              role="alert"
            >
              {{ subscriptionError }}
            </p>

            <template v-else-if="subscriptionState">
              <dl class="facts-grid">
                <div>
                  <dt>Plan</dt>
                  <dd>{{ planLabel(subscriptionState.currentPlanCode) }}</dd>
                </div>
                <div>
                  <dt>Statut</dt>
                  <dd>
                    <span
                      class="badge"
                      :class="`is-${statusTone(subscriptionState.subscription?.status ?? null)}`"
                    >
                      {{ subscriptionStatusLabel }}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Fin de période</dt>
                  <dd>{{ formatDate(subscriptionState.subscription?.currentPeriodEndISO ?? null) }}</dd>
                </div>
                <div>
                  <dt>Logements en ligne</dt>
                  <dd>
                    {{ subscriptionState.listingAllowance.activeListings }} / {{ subscriptionState.listingAllowance.maxActiveListings ?? '∞' }}
                    <small>({{ subscriptionState.listingAllowance.includedListings }} inclus + {{ subscriptionState.listingAllowance.extraListings }} supplémentaires)</small>
                  </dd>
                </div>
              </dl>

              <div
                v-if="isComplimentary"
                class="gift"
              >
                <h3><Gift
                  :size="16"
                  aria-hidden="true"
                /> Plan offert par IndieHost</h3>
                <p class="meta">
                  Aucun paiement demandé à ce client. Retirer le plan gèle ses annonces en ligne.
                </p>
                <div class="action ghost">
                  <button
                    type="button"
                    :disabled="isRevoking"
                    @click="revokeGift"
                  >
                    {{ isRevoking ? 'Retrait...' : (isRevokeArmed ? 'Confirmer le retrait' : 'Retirer le plan offert') }}
                  </button>
                </div>
              </div>

              <div
                v-else-if="!isSubscriptionActive"
                class="gift"
              >
                <h3><Gift
                  :size="16"
                  aria-hidden="true"
                /> Offrir un plan</h3>
                <p class="meta">
                  Active le compte sans paiement : vous pouvez ensuite créer et publier ses annonces à sa place. Il devra tout de même connecter Stripe pour encaisser ses voyageurs.
                </p>

                <fieldset class="plan-choice">
                  <legend>Plan</legend>
                  <label
                    v-for="code in PLAN_CODES"
                    :key="`gift-${code}`"
                    :class="{ 'is-selected': giftPlanCode === code }"
                  >
                    <input
                      v-model="giftPlanCode"
                      type="radio"
                      name="admin-gift-plan"
                      :value="code"
                    />
                    <span class="plan-name">{{ getMarketingPricingPlan(code).name }}</span>
                    <span class="plan-price">{{ getMarketingPricingPlan(code).includes[0] }}</span>
                  </label>
                </fieldset>

                <div class="stepper-row">
                  <span class="stepper-label">Logements supplémentaires</span>
                  <div class="stepper">
                    <button
                      type="button"
                      aria-label="Retirer"
                      :disabled="giftExtraListings <= 0"
                      @click="adjustGiftExtra(-1)"
                    >
                      <Minus :size="16" />
                    </button>
                    <output aria-live="polite">{{ giftExtraListings }}</output>
                    <button
                      type="button"
                      aria-label="Ajouter"
                      :disabled="giftExtraListings >= 50"
                      @click="adjustGiftExtra(1)"
                    >
                      <Plus :size="16" />
                    </button>
                  </div>
                </div>

                <div class="gift-until">
                  <label for="admin-gift-ends-at">Jusqu’au (laisser vide = sans limite)</label>
                  <div class="input">
                    <input
                      id="admin-gift-ends-at"
                      v-model="giftEndsAt"
                      type="date"
                    />
                  </div>
                </div>

                <div class="action">
                  <button
                    type="button"
                    :disabled="isGranting"
                    @click="grantGift"
                  >
                    <Gift :size="16" />
                    {{ isGranting ? 'Activation...' : 'Offrir ce plan' }}
                  </button>
                </div>
              </div>

              <p
                v-if="giftMessage"
                class="meta is-success"
              >
                {{ giftMessage }}
              </p>
              <p
                v-if="giftError"
                class="meta is-error"
                role="alert"
              >
                {{ giftError }}
              </p>

              <div class="extra">
                <h3>Logements supplémentaires <small>{{ isComplimentary ? 'offerts' : `${extraListingPrice} / mois chacun` }}</small></h3>
                <p
                  v-if="!isSubscriptionActive"
                  class="meta"
                >
                  Offrez un plan ci-dessus ou envoyez un lien d’abonnement pour pouvoir ajouter des logements supplémentaires.
                </p>
                <div
                  v-else
                  class="stepper-row"
                >
                  <div class="stepper">
                    <button
                      type="button"
                      aria-label="Retirer un logement supplémentaire"
                      :disabled="isSavingExtra || extraDraft <= 0"
                      @click="adjustExtraDraft(-1)"
                    >
                      <Minus :size="16" />
                    </button>
                    <output aria-live="polite">{{ extraDraft }}</output>
                    <button
                      type="button"
                      aria-label="Ajouter un logement supplémentaire"
                      :disabled="isSavingExtra || extraDraft >= 50"
                      @click="adjustExtraDraft(1)"
                    >
                      <Plus :size="16" />
                    </button>
                  </div>
                  <div class="action">
                    <button
                      type="button"
                      :disabled="!isExtraDirty || isSavingExtra"
                      @click="saveExtraListings"
                    >
                      {{ isSavingExtra ? 'Mise à jour...' : 'Appliquer' }}
                    </button>
                  </div>
                </div>
                <p
                  v-if="extraMessage"
                  class="meta is-success"
                >
                  {{ extraMessage }}
                </p>
                <p
                  v-if="extraError"
                  class="meta is-error"
                  role="alert"
                >
                  {{ extraError }}
                </p>
              </div>
            </template>
          </section>

          <section
            v-if="selectedUser.id"
            class="admin-card payment-link"
          >
            <h2>Lien d’abonnement à envoyer</h2>
            <p class="hint">Paiement Stripe au nom du client (essai gratuit 30 jours inclus). Le lien est valable 24 heures ; dès le paiement, son plan s’active à sa prochaine connexion.</p>

            <div class="link-form">
              <fieldset class="plan-choice">
                <legend>Plan</legend>
                <label
                  v-for="code in PLAN_CODES"
                  :key="code"
                  :class="{ 'is-selected': linkPlanCode === code }"
                >
                  <input
                    v-model="linkPlanCode"
                    type="radio"
                    name="admin-link-plan"
                    :value="code"
                  />
                  <span class="plan-name">{{ getMarketingPricingPlan(code).name }}</span>
                  <span class="plan-price">{{ getMarketingPricingPlan(code).displayPrice }}</span>
                </label>
              </fieldset>

              <div class="stepper-row">
                <span class="stepper-label">Logements supplémentaires</span>
                <div class="stepper">
                  <button
                    type="button"
                    aria-label="Retirer"
                    :disabled="linkExtraListings <= 0"
                    @click="adjustLinkExtra(-1)"
                  >
                    <Minus :size="16" />
                  </button>
                  <output aria-live="polite">{{ linkExtraListings }}</output>
                  <button
                    type="button"
                    aria-label="Ajouter"
                    :disabled="linkExtraListings >= 50"
                    @click="adjustLinkExtra(1)"
                  >
                    <Plus :size="16" />
                  </button>
                </div>
              </div>

              <div class="action">
                <button
                  type="button"
                  :disabled="isGeneratingLink"
                  @click="generateLink"
                >
                  <Link2 :size="16" />
                  {{ isGeneratingLink ? 'Génération...' : 'Générer le lien de paiement' }}
                </button>
              </div>
            </div>

            <p
              v-if="linkError"
              class="meta is-error"
              role="alert"
            >
              {{ linkError }}
            </p>

            <div
              v-if="generatedLink"
              class="link-result"
            >
              <p class="link-url">
                <a
                  :href="generatedLink.url"
                  target="_blank"
                  rel="noreferrer"
                >{{ generatedLink.url }}</a>
              </p>
              <div class="link-actions">
                <div class="action ghost">
                  <button
                    type="button"
                    @click="copyLink"
                  >
                    <Check
                      v-if="hasCopiedLink"
                      :size="16"
                    />
                    <Copy
                      v-else
                      :size="16"
                    />
                    {{ hasCopiedLink ? 'Copié' : 'Copier le lien' }}
                  </button>
                </div>
                <div
                  v-if="linkMailto"
                  class="action ghost"
                >
                  <a :href="linkMailto">
                    <Mail :size="16" />
                    Envoyer par email
                  </a>
                </div>
              </div>
              <p class="meta">
                <template v-if="generatedLink.expiresAtISO">Expire le {{ formatDate(generatedLink.expiresAtISO) }}.</template>
                <template v-if="generatedLink.message"> {{ generatedLink.message }}</template>
              </p>
            </div>
          </section>
        </template>
      </section>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Admin/admin.scss';
</style>
