<!-- File: src/views/Editor/components/EditorListings/EditorListings.vue -->

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useUser } from '@clerk/vue'

import AbsoluteOverlay from '@/components/overlays/AbsoluteOverlay.vue'
import { fetchMyUser, searchAdminPlatformUsers, transferListingOwnershipAsAdmin, type AdminPlatformUser } from '@/domain/api/users'
import { normalizeListingStatus } from '@/domain/listings/status'
import { getUserMaxActiveListings } from '@/domain/user/subscription'
import { readActiveUserId } from '@/router/backOfficeUser'
import { hasClerkAdminRole } from '@/utils/clerkRole'
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
const { user } = useUser()
const listingContent = editorStatic.listings
const ACTIVE_LISTING_STATUSES = new Set([
  'published',
  'blocked',
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

const apiAdminAccess = ref<boolean | null>(null)
const isAdminUser = computed(() => Boolean(apiAdminAccess.value) || hasClerkAdminRole(user.value))
const maxActiveListings = computed(() => (isAdminUser.value ? Number.POSITIVE_INFINITY : getUserMaxActiveListings()))
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

function normalizeTransferSearchField(user: AdminPlatformUser): string {
  return normalizeSearchText([
    user.firstName ?? '',
    user.lastName ?? '',
    user.displayName ?? '',
    user.email ?? '',
    `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
    `${user.lastName ?? ''} ${user.firstName ?? ''}`.trim(),
  ].join(' '))
}

const transferFilteredUsers = computed(() => {
  const queryValue = normalizeSearchText(transferSearch.value)
  if (!queryValue) return transferUsers.value

  return transferUsers.value.filter((user) => {
    const searchable = normalizeTransferSearchField(user)
    if (!searchable) return false
    return searchable.includes(queryValue)
  })
})

const selectedTransferUser = computed(() => {
  const userId = transferSelectedUserId.value
  if (!userId) return null
  return transferUsers.value.find((item) => item.id === userId) ?? null
})

const isTransferActionDisabled = computed(() => {
  if (!isAdminUser.value) return true
  if (!transferListing.value) return true
  if (!selectedTransferUser.value) return true
  return isTransferSubmitting.value
})

function formatTransferUserLabel(user: AdminPlatformUser): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  if (fullName) return fullName
  if (user.displayName) return user.displayName
  if (user.email) return user.email
  return user.id
}

function formatTransferUserMeta(user: AdminPlatformUser): string {
  const meta = [user.displayName, user.email].filter(Boolean).join(' · ').trim()
  if (meta) return meta
  return user.id
}

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

function waitMs(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function loadAdminAccessFromApi() {
  if (!user.value?.id) {
    apiAdminAccess.value = null
    return
  }

  const maxAttempts = 3
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const me = await fetchMyUser()
      apiAdminAccess.value = Boolean(me.isAdmin)
      return
    } catch (error) {
      if (attempt >= maxAttempts - 1) {
        console.warn('[EditorListings] failed to resolve admin access from API, fallback to Clerk metadata', error)
        apiAdminAccess.value = null
        return
      }
      await waitMs(250)
    }
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
  transferTrialDays.value = 0
  transferErrorMessage.value = null
  isTransferDialogOpen.value = true

  if (!hasLoadedTransferUsers.value) {
    void loadTransferUsers()
  }
}

function closeTransferDialogInternal(options?: { force?: boolean }) {
  if (isTransferSubmitting.value && !options?.force) return

  isTransferDialogOpen.value = false
  transferListing.value = null
  transferSearch.value = ''
  transferSelectedUserId.value = null
  transferTrialDays.value = 0
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
    const normalizedTrialDays = Number.isFinite(Number(transferTrialDays.value))
      ? Math.max(0, Math.min(365, Math.trunc(Number(transferTrialDays.value))))
      : 0

    await transferListingOwnershipAsAdmin(listing.listingId, {
      targetUserId: target.id,
      trialDays: normalizedTrialDays,
    })

    emit('listing-transferred', { listingId: listing.listingId })
    closeTransferDialogInternal({ force: true })
  } catch (error) {
    transferErrorMessage.value = toApiErrorMessage(error, 'Impossible de transférer cette annonce.')
  } finally {
    isTransferSubmitting.value = false
  }
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

watch(
  () => user.value?.id ?? null,
  () => {
    void loadAdminAccessFromApi()
  },
  { immediate: true },
)
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
          :isStripeConnectPublishLocked="props.isStripeConnectPublishLocked"
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
          <label class="field">
            <span>Rechercher un utilisateur</span>
            <input
              v-model="transferSearch"
              type="text"
              placeholder="Nom, prénom, pseudo ou e-mail"
              autocomplete="off"
            />
          </label>

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
                <span class="name">{{ formatTransferUserLabel(userItem) }}</span>
                <span class="meta">{{ formatTransferUserMeta(userItem) }}</span>
              </button>

              <p
                v-if="!transferFilteredUsers.length"
                class="state"
              >
                Aucun utilisateur trouvé.
              </p>
            </template>
          </div>

          <label class="field">
            <span>Durée d’essai gratuit (en jours)</span>
            <input
              v-model.number="transferTrialDays"
              type="number"
              min="0"
              max="365"
              step="1"
              inputmode="numeric"
            />
            <small>0 = aucun essai gratuit</small>
          </label>
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
            @click="submitTransfer"
          >
            {{ isTransferSubmitting ? 'Transfert...' : 'Transférer' }}
          </button>
        </div>
      </div>
    </AbsoluteOverlay>
  </section>
</template>

<style lang="scss">
@use '@/views/Editor/components/EditorListings/editor-listings.scss';
</style>
