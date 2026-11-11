<!-- File: src/views/Editor/_Editor.vue -->

<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAdminAccess } from '@/composables/useAdminAccess'
import { vp } from '@/utils/viewport'
import EditorListings from '@/views/Editor/components/EditorListings/EditorListings.vue'
import EditorSidebar from '@/views/Editor/components/EditorSidebar/EditorSidebar.vue'
import EditorPreview from '@/views/Editor/components/EditorPreview/EditorPreview.vue'

import type { EditorListingContext, EditorSectionId } from '@/views/Editor/components/EditorSidebar/editorSections'
import type { AttachableListing } from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/HubChildrenPanel.vue'
import { useEditorController } from '@/views/Editor/composables/useEditorController'
import type { EditorMode, EditorSource } from '@/views/Editor/types/editor'

const props = defineProps<{
  mode: EditorMode
  source: EditorSource
}>()

const route = useRoute()
const router = useRouter()
const { isAdminUser } = useAdminAccess()
// Le super admin publie à la place d'un client ; l'API lève les conditions de facturation pour lui.
const canPublishListings = computed(() => true)

const {
  applyDraftPatch,
  applyListingStatusPatch,
  cancelSelectedDraftChanges,
  domainRevision,
  draft,
  draftStatus,
  handleListingDomainUpdated,
  handleListingTransferred,
  handleSelectListing,
  hasAnyPendingChanges,
  hasMultiplePendingListings,
  isPatchSyncPending,
  lastDraftSavedAt,
  isStripeConnectPublishLocked,
  listings,
  listingsStatus,
  pendingListingsCount,
  previewRawListing,
  publishAllPendingDrafts,
  publishSelectedDraft,
  reloadListings,
  selectedListingId,
  selectedListingHasPendingChanges,
  showListings,
  showPreview,
  stage,
} = useEditorController({
  route,
  source: toRef(props, 'source'),
  canPublishListings,
})

const selectedListingCard = computed(() => listings.value.find((item) => item.listingId === selectedListingId.value) ?? null)

// Place de l'annonce ouverte : la page principale qui la présente, ou les logements qu'elle présente.
const listingContext = computed<EditorListingContext>(() => {
  const card = selectedListingCard.value
  if (!card) return {}
  if (card.kind === 'hub') {
    return { childrenCount: listings.value.filter((item) => item.parentListingId === card.listingId).length }
  }
  const parent = card.parentListingId
    ? listings.value.find((item) => item.listingId === card.parentListingId && item.kind === 'hub')
    : null
  return parent ? { parentId: parent.listingId, parentTitle: parent.title || 'Page principale' } : {}
})

// Logements que la page principale ouverte peut accueillir : même propriétaire, sans page principale.
const attachableListings = computed<AttachableListing[]>(() => {
  const card = selectedListingCard.value
  if (!card || card.kind !== 'hub') return []
  return listings.value
    .filter((item) => item.kind !== 'hub' && !item.parentListingId && (item.ownerId ?? null) === (card.ownerId ?? null))
    .map((item) => ({
      listingId: item.listingId,
      title: item.title || 'Annonce sans titre',
      coverSrc: item.coverSrc ?? null,
      status: item.status ?? 'draft',
    }))
})

// Demande d'ouverture d'une section de la colonne de gauche (depuis le bloc d'une page principale).
const focusSection = ref<{ listingId: string; section: EditorSectionId } | null>(null)

function handleOpenSection(payload: { listingId: string; section: EditorSectionId }) {
  focusSection.value = payload
  handleListingSelect(payload.listingId)
}

const isCreatingHub = ref(false)

// Page principale (annonce mère) : créée en brouillon puis ouverte directement dans l'éditeur.
async function handleCreateHub() {
  if (isCreatingHub.value) return
  isCreatingHub.value = true
  try {
    const { listingId } = await props.source.createListing({
      core: { kind: 'hub', title: 'Nos logements', status: 'draft' },
    })
    await reloadListings()
    await handleSelectListing(listingId, { force: true })
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Impossible de créer la page principale.')
  } finally {
    isCreatingHub.value = false
  }
}

const isMobileSidebarOpen = ref(false)

const isPreviewAvailable = computed(() => vp.lg.value)
const isMobileViewport = computed(() => !vp.lg.value)
const isMobileEditingStep = computed(
  () => isMobileViewport.value && isMobileSidebarOpen.value && Boolean(selectedListingId.value && draft.value),
)

function handleListingSelect(listingId: string) {
  if (isMobileViewport.value) {
    isMobileSidebarOpen.value = true
  }
  void handleSelectListing(listingId)
}

function handleMobileBackToListings() {
  isMobileSidebarOpen.value = false
  showListings()
}

function handleConfigureStripeConnect(listingId: string) {
  void router.push({
    name: 'pricing-callback',
    query: {
      onboarding: 'listing',
      intent: 'publish',
      listingId,
    },
  })
}

watch(
  isPreviewAvailable,
  (isAvailable) => {
    if (isAvailable || stage.value !== 'preview') return
    showListings()
  },
  { immediate: true },
)

watch(
  isMobileViewport,
  () => {
    isMobileSidebarOpen.value = false
  },
  { immediate: true },
)

watch(selectedListingId, (listingId) => {
  if (listingId) return
  isMobileSidebarOpen.value = false
})
</script>

<template>
  <section
    id="editor-page"
    class="editor"
  >
    <div
      class="layout"
      :class="{ 'is-mobile-editing': isMobileEditingStep }"
    >
      <Transition name="editor-sidebar">
        <div
          v-if="selectedListingId && draft"
          class="sidebar-shell"
          :class="{ 'is-mobile-open': isMobileEditingStep }"
        >
          <EditorSidebar
            :listingId="selectedListingId"
            :draft="draft"
            :showMobileBack="isMobileViewport"
            :isLoading="draftStatus.isLoading"
            :isPatchSyncing="isPatchSyncPending"
            :lastSavedAt="lastDraftSavedAt"
            :hasPendingChanges="selectedListingHasPendingChanges"
            :hasAnyPendingChanges="hasAnyPendingChanges"
            :hasMultiplePendingListings="hasMultiplePendingListings"
            :pendingListingsCount="pendingListingsCount"
            :publishAllPending="publishAllPendingDrafts"
            :publish="publishSelectedDraft"
            :cancelPendingChanges="cancelSelectedDraftChanges"
            :canPublishListing="canPublishListings"
            :isAdmin="isAdminUser"
            :host="previewRawListing?.host ?? null"
            :context="listingContext"
            :attachableListings="attachableListings"
            :focusSection="focusSection"
            @focus-consumed="focusSection = null"
            @patch="applyDraftPatch"
            @domain-updated="handleListingDomainUpdated"
            @mobile-back="handleMobileBackToListings"
            @select-listing="handleListingSelect"
            @links-changed="reloadListings"
          />
        </div>
      </Transition>

      <section class="stage">
        <div class="content">
          <Transition name="editor-stage">
            <EditorListings
              v-show="stage === 'listings'"
              :listings="listings"
              :isLoading="listingsStatus.isLoading"
              :error="listingsStatus.error"
              :selectedListingId="selectedListingId"
              :isStripeConnectPublishLocked="isStripeConnectPublishLocked"
              :canPreview="isPreviewAvailable"
              :isAdmin="isAdminUser"
              :isCreatingHub="isCreatingHub"
              @select="handleListingSelect"
              @preview="showPreview"
              @status-change="applyListingStatusPatch"
              @configure-connect="handleConfigureStripeConnect"
              @listing-transferred="handleListingTransferred"
              @create-hub="handleCreateHub"
              @open-section="handleOpenSection"
            />
          </Transition>

          <Transition name="editor-stage">
            <EditorPreview
              v-show="stage === 'preview' && isPreviewAvailable"
              :rawListing="previewRawListing"
              :listingId="selectedListingId"
              :domainRevision="domainRevision"
              :isLoading="draftStatus.isLoading"
              :isShowed="stage === 'preview' && isPreviewAvailable"
              @back="showListings"
            />
          </Transition>
        </div>
      </section>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Editor/editor.scss';
</style>
