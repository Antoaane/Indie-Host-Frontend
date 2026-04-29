<!-- File: src/views/Editor/_Editor.vue -->

<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAdminAccess } from '@/composables/useAdminAccess'
import { vp } from '@/utils/viewport'
import EditorListings from '@/views/Editor/components/EditorListings/EditorListings.vue'
import EditorSidebar from '@/views/Editor/components/EditorSidebar/EditorSidebar.vue'
import EditorPreview from '@/views/Editor/components/EditorPreview/EditorPreview.vue'

import { useEditorController } from '@/views/Editor/composables/useEditorController'
import type { EditorMode, EditorSource } from '@/views/Editor/types/editor'

const props = defineProps<{
  mode: EditorMode
  source: EditorSource
}>()

const route = useRoute()
const router = useRouter()
const { isAdminUser } = useAdminAccess()
const canPublishListings = computed(() => !isAdminUser.value)

const {
  applyDraftPatch,
  applyListingStatusPatch,
  cancelSelectedDraftChanges,
  draft,
  draftStatus,
  handleListingTransferred,
  handleSelectListing,
  hasAnyPendingChanges,
  hasMultiplePendingListings,
  isPatchSyncPending,
  isStripeConnectPublishLocked,
  listings,
  listingsStatus,
  pendingListingsCount,
  previewRawListing,
  publishAllPendingDrafts,
  publishSelectedDraft,
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
            :hasPendingChanges="selectedListingHasPendingChanges"
            :hasAnyPendingChanges="hasAnyPendingChanges"
            :hasMultiplePendingListings="hasMultiplePendingListings"
            :pendingListingsCount="pendingListingsCount"
            :publishAllPending="publishAllPendingDrafts"
            :publish="publishSelectedDraft"
            :cancelPendingChanges="cancelSelectedDraftChanges"
            :canPublishListing="canPublishListings"
            :isAdmin="isAdminUser"
            @patch="applyDraftPatch"
            @mobile-back="handleMobileBackToListings"
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
              @select="handleListingSelect"
              @preview="showPreview"
              @status-change="applyListingStatusPatch"
              @configure-connect="handleConfigureStripeConnect"
              @listing-transferred="handleListingTransferred"
            />
          </Transition>

          <Transition name="editor-stage">
            <EditorPreview
              v-show="stage === 'preview' && isPreviewAvailable"
              :rawListing="previewRawListing"
              :listingId="selectedListingId"
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
