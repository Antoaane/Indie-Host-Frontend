<!-- File: src/views/Editor/components/EditorListings/EditorListings.vue -->

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AbsoluteOverlay from '@/components/overlays/AbsoluteOverlay.vue'
import ConfirmationDialog from '@/components/overlays/ConfirmationDialog.vue'
import NumberStepper from '@/components/inputs/NumberStepper.vue'
import { fetchMyStripeSubscriptionState, updateMyExtraListings, type StripeSubscriptionState } from '@/domain/api/stripeSubscriptions'
import { searchAdminPlatformUsers, transferListingOwnershipAsAdmin, type AdminPlatformUser } from '@/domain/api/users'
import { normalizeListingStatus } from '@/domain/listings/status'
import { formatExtraListingPrice } from '@/domain/payments/pricingPlanCatalog'
import { getUserMaxActiveListings } from '@/domain/user/subscription'
import { readActiveUserId } from '@/router/backOfficeUser'
import { normalizeSearchText } from '@/utils/search'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import type { UserListingCard } from '@/views/Editor/utils/listingApi'
import EditorListingCard from '@/views/Editor/components/EditorListings/components/EditorListingCard.vue'
import EditorListingsCreateCard from '@/views/Editor/components/EditorListings/components/EditorListingsCreateCard.vue'
import EditorListingsToolbar from '@/views/Editor/components/EditorListings/components/EditorListingsToolbar.vue'

const props = defineProps<{
  listings: UserListingCard[]
  isLoading?: boolean
  error?: unknown
  selectedListingId: string | null
  isStripeConnectPublishLocked?: boolean
  canPreview?: boolean
  isAdmin?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', listingId: string): void
  (e: 'preview', listingId: string): void
  (e: 'status-change', payload: { listingId: string; status: string }): void
  (e: 'configure-connect', listingId: string): void
  (e: 'listing-transferred', payload: { listingId: string }): void
}>()

const query = ref('')
const route = useRoute()
const router = useRouter()
const listingContent = editorStatic.listings
// Annonces « en ligne » qui consomment un logement du plan (les brouillons sont libres).
const ACTIVE_LISTING_STATUSES = new Set([
  'published',
  'blocked',
  'paused',
])
const STATUS_OPTIONS = [
  'published',
  'blocked',
  'paused',
] as const
type CardMenuType = 'status' | 'actions'
type OpenCardMenuState = {
  listingId: string
  type: CardMenuType
}

const isAdminUser = computed(() => Boolean(props.isAdmin))

// Limite réelle du plan (logements inclus + supplémentaires), calculée par l'API.
const billingState = ref<StripeSubscriptionState | null>(null)
const isExtraListingBusy = ref(false)
const extraListingError = ref<string | null>(null)
const isSubscriptionActive = computed(() => {
  const status = (billingState.value?.subscription?.status ?? '').toLowerCase()
  return status === 'active' || status === 'trialing'
})
const extraListingPriceLabel = computed(() => formatExtraListingPrice(billingState.value?.extraListing))
const limitCtaLabel = computed(() => {
  if (isExtraListingBusy.value) return listingContent.newListing.addExtraListingBusy
  if (!isSubscriptionActive.value) return listingContent.newListing.choosePlan
  return listingContent.newListing.addExtraListing.replace('{price}', extraListingPriceLabel.value)
})

async function loadBillingState() {
  if (isAdminUser.value) return
  try {
    billingState.value = await fetchMyStripeSubscriptionState()
  } catch (error) {
    console.warn('[EditorListings] failed to load subscription state', error)
  }
}

async function handleLimitCta() {
  if (isExtraListingBusy.value) return
  extraListingError.value = null

  if (!isSubscriptionActive.value) {
    await router.push('/pricing')
    return
  }

  isExtraListingBusy.value = true
  try {
    const current = billingState.value?.listingAllowance.extraListings ?? 0
    const result = await updateMyExtraListings(current + 1)
    if (result.state !== 'updated') {
      extraListingError.value = result.message ?? 'Impossible d’ajouter un logement supplémentaire.'
      return
    }
    await loadBillingState()
  } catch (error) {
    extraListingError.value = toApiErrorMessage(error, 'Impossible d’ajouter un logement supplémentaire.')
  } finally {
    isExtraListingBusy.value = false
  }
}

const maxActiveListings = computed(() => (
  isAdminUser.value ? Number.POSITIVE_INFINITY : getUserMaxActiveListings(billingState.value?.listingAllowance ?? null)
))
const activeListingsCount = computed(() => props.listings.reduce((count, listing) => count + (isActiveListingStatus(listing.status) ? 1 : 0), 0))
const maxActiveListingsDisplay = computed(() => (Number.isFinite(maxActiveListings.value) ? String(maxActiveListings.value) : '∞'))
const remainingActiveListings = computed(() => (isAdminUser.value ? Number.POSITIVE_INFINITY : Math.max(0, maxActiveListings.value - activeListingsCount.value)))
const remainingActiveListingsDisplay = computed(() => (Number.isFinite(remainingActiveListings.value) ? String(remainingActiveListings.value) : '∞'))
const isActiveListingsLimitReached = computed(() => !isAdminUser.value && remainingActiveListings.value <= 0)
const newListingActiveUsage = computed(() => listingContent.newListing.activeUsage
  .replace('{count}', String(activeListingsCount.value))
  .replace('{max}', maxActiveListingsDisplay.value))
const newListingRemaining = computed(() => listingContent.newListing.remaining.replace('{count}', remainingActiveListingsDisplay.value))
const newListingRemainingDisplay = computed(() => (isActiveListingsLimitReached.value ? `${newListingRemaining.value} ${listingContent.newListing.remainingAlertSuffix}` : newListingRemaining.value))
const activeUserId = computed(() => readActiveUserId(route.params.userId))

const createListingRoute = computed(() => {
  const userId = activeUserId.value
  if (userId) {
    return {
      name: 'create-listing',
    }
  }

  return {
    name: 'sign-in',
    query: { redirect_url: '/dashboard/editor/create' },
  }
})

const filtered = computed(() => {
  const q = normalizeSearchText(query.value)
  const base = q
    ? props.listings.filter((item) => normalizeSearchText(item.title).includes(q))
    : props.listings

  // Annonces avec modifications en premier
  return [...base].sort((a, b) => {
    const ap = Boolean(a.hasPendingChanges)
    const bp = Boolean(b.hasPendingChanges)
    if (ap === bp) return 0
    return ap ? -1 : 1
  })
})

const openCardMenu = ref<OpenCardMenuState | null>(null)
const isTransferDialogOpen = ref(false)
const transferListing = ref<UserListingCard | null>(null)
const transferUsers = ref<AdminPlatformUser[]>([])
const transferSearch = ref('')
const transferSelectedUserId = ref<string | null>(null)
const transferTrialDays = ref<number>(0)
const isTransferUsersLoading = ref(false)
const isTransferSubmitting = ref(false)
const transferErrorMessage = ref<string | null>(null)
const hasLoadedTransferUsers = ref(false)
const isTransferConfirmationOpen = ref(false)
const TRANSFER_TRIAL_MIN_DAYS = 0
const TRANSFER_TRIAL_MAX_DAYS = 365
const transferTrialPresetDays = [
  0,
  7,
  14,
  30,
] as const

function normalizeTransferTrialDays(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return TRANSFER_TRIAL_MIN_DAYS
  return Math.max(TRANSFER_TRIAL_MIN_DAYS, Math.min(TRANSFER_TRIAL_MAX_DAYS, Math.trunc(parsed)))
}

function setTransferTrialDays(value: unknown) {
  transferTrialDays.value = normalizeTransferTrialDays(value)
}

function stepTransferTrialDays(delta: number) {
  setTransferTrialDays(transferTrialDays.value + delta)
}

const normalizedTransferTrialDays = computed(() => normalizeTransferTrialDays(transferTrialDays.value))
const transferTrialSummary = computed(() => {
  const days = normalizedTransferTrialDays.value
  if (days <= 0) return 'Aucun essai gratuit.'

  const endsAt = new Date()
  endsAt.setHours(0, 0, 0, 0)
  endsAt.setDate(endsAt.getDate() + days)
  const endDateLabel = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(endsAt)

  return `Essai actif pendant ${days} jour${days > 1 ? 's' : ''}, jusqu’au ${endDateLabel}.`
})

function handleSelect(listingId: string) {
  emit('select', listingId)
}

function handlePreview(listingId: string) {
  emit('preview', listingId)
}

function setListingStatus(payload: { listingId: string; status: string }) {
  closeCardMenus()
  emit('status-change', payload)
}

// Toute mise en ligne / retrait change le nombre de logements consommés : on resynchronise la limite.
watch(activeListingsCount, () => {
  void loadBillingState()
})

onMounted(() => {
  void loadBillingState()
})

function handleConfigureConnect(listingId: string) {
  closeCardMenus()
  emit('configure-connect', listingId)
}

function toApiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage.trim()
  }

  return fallback
}

function normalizeIdentityToken(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[@\s._-]+/g, '')
    .trim()
}

function isDeprecatedHostIdentity(value: string | null | undefined): boolean {
  if (!value) return false
  const normalized = normalizeIdentityToken(value)
  return normalized === 'hote' || normalized === 'host'
}

function normalizeTransferSearchField(user: AdminPlatformUser): string {
  return normalizeSearchText([
    user.firstName ?? '',
    user.lastName ?? '',
    user.displayName ?? '',
    user.username ?? '',
    user.email ?? '',
    `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
    `${user.lastName ?? ''} ${user.firstName ?? ''}`.trim(),
  ].join(' '))
}

const transferFilteredUsers = computed(() => {
  const queryValue = normalizeSearchText(transferSearch.value)
  const base = queryValue
    ? transferUsers.value.filter((user) => {
      const searchable = normalizeTransferSearchField(user)
      if (!searchable) return false
      return searchable.includes(queryValue)
    })
    : transferUsers.value

  return [...base].sort((left, right) => {
    const scoreDelta = transferUserVisibilityScore(right) - transferUserVisibilityScore(left)
    if (scoreDelta !== 0) return scoreDelta
    return formatTransferUserLabel(left).localeCompare(formatTransferUserLabel(right), 'fr', { sensitivity: 'base' })
  })
})

function transferUserVisibilityScore(user: AdminPlatformUser): number {
  let score = 0
  if (user.email) score += 3
  if (user.username) score += 2
  if (user.displayName) score += 2
  if (user.firstName || user.lastName) score += 2
  if (user.avatarUrl) score += 1
  return score
}

const selectedTransferUser = computed(() => {
  const userId = transferSelectedUserId.value
  if (!userId) return null
  return transferUsers.value.find((item) => item.id === userId) ?? null
})

const isTransferActionDisabled = computed(() => {
  if (!isAdminUser.value) return true
  if (!transferListing.value) return true
  if (!selectedTransferUser.value) return true
  if (isTransferTargetCurrentOwner.value) return true
  return isTransferSubmitting.value
})

const isTransferTargetCurrentOwner = computed(() => {
  const listing = transferListing.value
  const target = selectedTransferUser.value
  if (!listing || !target) return false

  const ownerId = (listing.ownerId ?? '').trim()
  if (!ownerId) return false
  return ownerId === target.id.trim()
})

function formatTransferUserLabel(user: AdminPlatformUser): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  if (fullName) return fullName
  if (user.displayName && !isDeprecatedHostIdentity(user.displayName)) return user.displayName
  if (user.username && !isDeprecatedHostIdentity(user.username)) return user.username
  if (user.email) return user.email.split('@')[0] ?? user.email
  return 'Profil utilisateur'
}

function formatTransferUserMeta(user: AdminPlatformUser): string {
  const email = (user.email ?? '').trim()
  const usernameRaw = (user.username ?? '').trim()
  const username = usernameRaw && !isDeprecatedHostIdentity(usernameRaw) ? usernameRaw : ''
  if (email && username) return `${email} · @${username}`
  if (email) return email
  if (username) return `@${username}`
  const meta = [user.displayName].filter((value) => Boolean(value) && !isDeprecatedHostIdentity(value ?? '')).join(' · ').trim()
  if (meta) return meta
  return 'Profil à compléter'
}

function formatTransferUserAlias(user: AdminPlatformUser): string | null {
  const username = (user.username ?? '').trim()
  if (!username) return null
  if (isDeprecatedHostIdentity(username)) return null
  const normalizedUsername = normalizeSearchText(username)
  const normalizedPrimary = normalizeSearchText(formatTransferUserLabel(user))
  if (normalizedUsername === normalizedPrimary) return null
  return `@${username}`
}

function formatTransferUserInitials(user: AdminPlatformUser): string {
  const source = formatTransferUserLabel(user).replace(/@/g, ' ').trim()
  const segments = source.split(/\s+/).filter(Boolean).slice(0, 2)
  if (segments.length >= 2) {
    const first = segments[0]?.[0] ?? ''
    const second = segments[1]?.[0] ?? ''
    return `${first}${second}`.toUpperCase()
  }
  const one = segments[0]?.slice(0, 2) ?? 'U'
  return one.toUpperCase()
}

function formatTransferUsersCount(count: number): string {
  return `${count} profil${count > 1 ? 's' : ''}`
}

function formatListingOwnerLabel(listing: UserListingCard | null): string {
  if (!listing) return 'Propriétaire inconnu'

  const displayNameRaw = (listing.ownerDisplayName ?? '').trim()
  const displayName = displayNameRaw && !isDeprecatedHostIdentity(displayNameRaw) ? displayNameRaw : ''
  if (displayName) return displayName

  const usernameRaw = (listing.ownerUsername ?? '').trim()
  const username = usernameRaw && !isDeprecatedHostIdentity(usernameRaw) ? usernameRaw : ''
  if (username) return `@${username}`

  const email = (listing.ownerEmail ?? '').trim()
  if (email) return email

  return 'Propriétaire inconnu'
}

function formatListingOwnerMeta(listing: UserListingCard | null): string {
  if (!listing) return 'Profil à compléter'

  const email = (listing.ownerEmail ?? '').trim()
  const usernameRaw = (listing.ownerUsername ?? '').trim()
  const username = usernameRaw && !isDeprecatedHostIdentity(usernameRaw) ? usernameRaw : ''
  if (email && username) return `${email} · @${username}`
  if (email) return email
  if (username) return `@${username}`
  return 'Profil à compléter'
}

const transferCurrentOwnerLabel = computed(() => formatListingOwnerLabel(transferListing.value))
const transferCurrentOwnerMeta = computed(() => formatListingOwnerMeta(transferListing.value))
const transferSelectedTargetLabel = computed(() => {
  if (!selectedTransferUser.value) return 'Aucun utilisateur sélectionné'
  return formatTransferUserLabel(selectedTransferUser.value)
})
const transferSelectedTargetMeta = computed(() => {
  if (!selectedTransferUser.value) return 'Choisissez un utilisateur dans la liste ci-dessous.'
  return formatTransferUserMeta(selectedTransferUser.value)
})
const transferConfirmationMessage = computed(() => {
  const listing = transferListing.value
  const target = selectedTransferUser.value
  const trialDays = normalizedTransferTrialDays.value

  if (!listing || !target) {
    return 'Ce transfert modifie définitivement le propriétaire de l’annonce.'
  }

  const trialMessage = trialDays > 0
    ? ` Un essai gratuit de ${trialDays} jour${trialDays > 1 ? 's' : ''} sera appliqué.`
    : ' Aucun essai gratuit ne sera appliqué.'

  return `Le propriétaire actuel (${formatListingOwnerLabel(listing)}) sera remplacé par ${formatTransferUserLabel(target)}.${trialMessage}`
})

async function loadTransferUsers() {
  if (!isAdminUser.value) return

  isTransferUsersLoading.value = true
  transferErrorMessage.value = null

  try {
    transferUsers.value = await searchAdminPlatformUsers({ limit: 2000 })
    hasLoadedTransferUsers.value = true
  } catch (error) {
    transferErrorMessage.value = toApiErrorMessage(error, 'Impossible de charger les utilisateurs.')
  } finally {
    isTransferUsersLoading.value = false
  }
}

function openTransferDialog(listingId: string) {
  if (!isAdminUser.value) return
  closeCardMenus()

  const listing = props.listings.find((item) => item.listingId === listingId) ?? null
  if (!listing) return

  transferListing.value = listing
  transferSearch.value = ''
  transferSelectedUserId.value = null
  setTransferTrialDays(0)
  transferErrorMessage.value = null
  isTransferDialogOpen.value = true

  if (!hasLoadedTransferUsers.value) {
    void loadTransferUsers()
  }
}

function closeTransferDialogInternal(options?: { force?: boolean }) {
  if (isTransferSubmitting.value && !options?.force) return

  isTransferConfirmationOpen.value = false
  isTransferDialogOpen.value = false
  transferListing.value = null
  transferSearch.value = ''
  transferSelectedUserId.value = null
  setTransferTrialDays(0)
  transferErrorMessage.value = null
}

function closeTransferDialog() {
  closeTransferDialogInternal()
}

async function submitTransfer() {
  const listing = transferListing.value
  const target = selectedTransferUser.value
  if (!listing || !target) return

  isTransferSubmitting.value = true
  transferErrorMessage.value = null

  try {
    await transferListingOwnershipAsAdmin(listing.listingId, {
      targetUserId: target.id,
      trialDays: normalizedTransferTrialDays.value,
    })

    emit('listing-transferred', { listingId: listing.listingId })
    closeTransferDialogInternal({ force: true })
  } catch (error) {
    transferErrorMessage.value = toApiErrorMessage(error, 'Impossible de transférer cette annonce.')
  } finally {
    isTransferSubmitting.value = false
  }
}

function openTransferConfirmationDialog() {
  if (isTransferActionDisabled.value) return
  isTransferConfirmationOpen.value = true
}

function closeTransferConfirmationDialog() {
  if (isTransferSubmitting.value) return
  isTransferConfirmationOpen.value = false
}

async function confirmTransferFromDialog() {
  if (isTransferActionDisabled.value) return
  isTransferConfirmationOpen.value = false
  await submitTransfer()
}

function isStatusMenuOpen(listingId: string) {
  return openCardMenu.value?.type === 'status' && openCardMenu.value.listingId === listingId
}

function isActionsMenuOpen(listingId: string) {
  return openCardMenu.value?.type === 'actions' && openCardMenu.value.listingId === listingId
}

function closeCardMenus() {
  openCardMenu.value = null
}

function toggleStatusMenu(listingId: string) {
  if (isStatusMenuOpen(listingId)) {
    closeCardMenus()
    return
  }
  openCardMenu.value = { listingId, type: 'status' }
}

function toggleActionsMenu(listingId: string) {
  if (isActionsMenuOpen(listingId)) {
    closeCardMenus()
    return
  }
  openCardMenu.value = { listingId, type: 'actions' }
}

function handleStatusMenuDocumentPointerDown(event: PointerEvent) {
  const target = event.target
  if (!(target instanceof Element)) {
    closeCardMenus()
    return
  }

  if (target.closest('.status-menu') || target.closest('.actions-menu')) return
  closeCardMenus()
}

function handleStatusMenuDocumentKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  closeCardMenus()
}

function isActiveListingStatus(status?: string) {
  const normalized = normalizeListingStatus(status)
  if (!normalized) return false
  return ACTIVE_LISTING_STATUSES.has(normalized)
}

onMounted(() => {
  window.addEventListener('pointerdown', handleStatusMenuDocumentPointerDown)
  window.addEventListener('keydown', handleStatusMenuDocumentKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', handleStatusMenuDocumentPointerDown)
  window.removeEventListener('keydown', handleStatusMenuDocumentKeyDown)
})

</script>

<template>
  <section class="editor-listings">
    <EditorListingsToolbar
      v-model="query"
      :placeholder="listingContent.searchPlaceholder"
    />

    <div class="scroll-container">
      <div class="grid">
        <EditorListingCard
          v-for="listing in filtered"
          :key="listing.listingId"
          :listing="listing"
          :isSelected="listing.listingId === props.selectedListingId"
          :isStatusMenuOpen="isStatusMenuOpen(listing.listingId)"
          :isActionsMenuOpen="isActionsMenuOpen(listing.listingId)"
          :statusOptions="STATUS_OPTIONS"
          :listingContent="listingContent"
          :isStripeConnectPublishLocked="!isAdminUser && props.isStripeConnectPublishLocked"
          :canPreview="props.canPreview !== false"
          :canTransfer="isAdminUser"
          @select="handleSelect"
          @preview="handlePreview"
          @toggle-status-menu="toggleStatusMenu"
          @toggle-actions-menu="toggleActionsMenu"
          @close-menus="closeCardMenus"
          @status-change="setListingStatus"
          @configure-connect="handleConfigureConnect"
          @transfer="openTransferDialog"
        />

        <EditorListingsCreateCard
          :to="createListingRoute"
          :title="listingContent.newListing.title"
          :activeUsage="newListingActiveUsage"
          :remainingDisplay="newListingRemainingDisplay"
          :isLimitReached="isActiveListingsLimitReached"
          :limitCtaLabel="isAdminUser ? null : limitCtaLabel"
          :isLimitCtaBusy="isExtraListingBusy"
          :limitCtaError="extraListingError"
          @limit-cta="handleLimitCta"
        />
      </div>
    </div>

    <div
      v-if="props.isLoading"
      class="state"
    >
      {{ editorStatic.states.loading }}
    </div>
    <div
      v-else-if="props.error"
      class="state"
    >
      {{ editorStatic.states.listingsLoadError }}
    </div>

    <AbsoluteOverlay
      class="editor-transfer-overlay"
      :open="isTransferDialogOpen"
      aria-label="Transférer une annonce"
      @close="closeTransferDialog"
    >
      <div class="editor-transfer-panel">
        <div class="header">
          <h3>Transférer cette annonce</h3>
          <p v-if="transferListing?.title">
            {{ transferListing.title }}
          </p>
        </div>

        <div class="body">
          <div class="transfer-context-grid">
            <div class="context-card">
              <span class="label">Annonce</span>
              <span class="value">{{ transferListing?.title || 'Annonce sans titre' }}</span>
              <span class="meta">ID: {{ transferListing?.listingId || 'n/a' }}</span>
            </div>
            <div class="context-card">
              <span class="label">Propriétaire actuel</span>
              <span class="value">{{ transferCurrentOwnerLabel }}</span>
              <span class="meta">{{ transferCurrentOwnerMeta }}</span>
            </div>
            <div class="context-card">
              <span class="label">Cible du transfert</span>
              <span class="value">{{ transferSelectedTargetLabel }}</span>
              <span class="meta">{{ transferSelectedTargetMeta }}</span>
            </div>
          </div>

          <label class="field">
            <span>Rechercher un utilisateur</span>
            <input
              v-model="transferSearch"
              type="text"
              placeholder="Nom, prénom, pseudo ou e-mail"
              autocomplete="off"
            />
          </label>

          <div class="users-caption">
            <span>{{ formatTransferUsersCount(transferFilteredUsers.length) }}</span>
          </div>

          <div class="users-list">
            <p
              v-if="isTransferUsersLoading"
              class="state"
            >
              Chargement des utilisateurs...
            </p>

            <template v-else>
              <p
                v-if="transferErrorMessage"
                class="state is-error"
              >
                {{ transferErrorMessage }}
              </p>

              <button
                v-for="userItem in transferFilteredUsers"
                :key="userItem.id"
                type="button"
                class="user-item"
                :class="{ 'is-selected': userItem.id === transferSelectedUserId }"
                @click="transferSelectedUserId = userItem.id"
              >
                <span
                  class="avatar"
                  aria-hidden="true"
                >
                  <img
                    v-if="userItem.avatarUrl"
                    :src="userItem.avatarUrl"
                    :alt="formatTransferUserLabel(userItem)"
                    loading="lazy"
                  />
                  <span v-else>{{ formatTransferUserInitials(userItem) }}</span>
                </span>
                <span class="identity">
                  <span class="line">
                    <span class="name">{{ formatTransferUserLabel(userItem) }}</span>
                    <span
                      v-if="formatTransferUserAlias(userItem)"
                      class="alias"
                    >
                      {{ formatTransferUserAlias(userItem) }}
                    </span>
                  </span>
                  <span class="meta">{{ formatTransferUserMeta(userItem) }}</span>
                </span>
              </button>

              <p
                v-if="!transferFilteredUsers.length"
                class="state"
              >
                Aucun utilisateur trouvé.
              </p>
            </template>
          </div>

          <section class="trial-field">
            <header>
              <span class="label">Durée d’essai gratuit</span>
              <span class="value">{{ normalizedTransferTrialDays }} jour{{ normalizedTransferTrialDays > 1 ? 's' : '' }}</span>
            </header>

            <NumberStepper
              :value="normalizedTransferTrialDays"
              :min="TRANSFER_TRIAL_MIN_DAYS"
              :max="TRANSFER_TRIAL_MAX_DAYS"
              :decrement-disabled="normalizedTransferTrialDays <= TRANSFER_TRIAL_MIN_DAYS"
              :increment-disabled="normalizedTransferTrialDays >= TRANSFER_TRIAL_MAX_DAYS"
              :disable-wheel="true"
              decrement-aria-label="Réduire la durée d’essai"
              increment-aria-label="Augmenter la durée d’essai"
              decrement-title="Réduire la durée d’essai"
              increment-title="Augmenter la durée d’essai"
              @decrement="stepTransferTrialDays(-1)"
              @increment="stepTransferTrialDays(1)"
              @input="setTransferTrialDays($event.number)"
            />

            <div class="presets">
              <button
                v-for="days in transferTrialPresetDays"
                :key="days"
                type="button"
                :class="{ 'is-active': normalizedTransferTrialDays === days }"
                @click="setTransferTrialDays(days)"
              >
                {{ days === 0 ? 'Aucun essai' : `${days} jours` }}
              </button>
            </div>

            <small>{{ transferTrialSummary }}</small>
          </section>

          <p
            v-if="isTransferTargetCurrentOwner"
            class="transfer-warning"
          >
            L’utilisateur sélectionné est déjà propriétaire de cette annonce.
          </p>
        </div>

        <div class="footer">
          <button
            type="button"
            :disabled="isTransferSubmitting"
            @click="closeTransferDialog"
          >
            Annuler
          </button>
          <button
            type="button"
            :disabled="isTransferActionDisabled"
            @click="openTransferConfirmationDialog"
          >
            {{ isTransferSubmitting ? 'Transfert...' : 'Transférer' }}
          </button>
        </div>
      </div>
    </AbsoluteOverlay>

    <ConfirmationDialog
      :open="isTransferConfirmationOpen"
      :level="2"
      title="Confirmer le transfert"
      :subject="transferListing?.title || 'Annonce'"
      :message="transferConfirmationMessage"
      confirm-word="confirmer"
      typing-hint='Tapez "confirmer" pour valider le transfert total de propriété.'
      confirm-label="Confirmer le transfert"
      cancel-label="Retour"
      :confirm-disabled="isTransferActionDisabled || isTransferSubmitting"
      :cancel-disabled="isTransferSubmitting"
      :close-on-backdrop="!isTransferSubmitting"
      :close-on-escape="!isTransferSubmitting"
      aria-label="Confirmation du transfert d’annonce"
      @confirm="confirmTransferFromDialog"
      @cancel="closeTransferConfirmationDialog"
      @close="closeTransferConfirmationDialog"
    />
  </section>
</template>

<style lang="scss">
@use '@/views/Editor/components/EditorListings/editor-listings.scss';
</style>
