<!-- File: src/views/Editor/_Editor.vue -->

<script setup lang="ts">
import { toRef } from 'vue'
import { useRoute } from 'vue-router'

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

const {
  applyDraftPatch,
  applyListingStatusPatch,
  cancelSelectedDraftChanges,
  draft,
  draftStatus,
  handleSelectListing,
  hasAnyPendingChanges,
  hasMultiplePendingListings,
  isPatchSyncPending,
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
})
</script>

<template>
  <main
    id="editor-page"
    class="editor"
  >
    <div class="layout">
      <Transition name="editor-sidebar">
        <EditorSidebar
          v-if="selectedListingId && draft"
          :listingId="selectedListingId"
          :draft="draft"
          :isLoading="draftStatus.isLoading"
          :isPatchSyncing="isPatchSyncPending"
          :hasPendingChanges="selectedListingHasPendingChanges"
          :hasAnyPendingChanges="hasAnyPendingChanges"
          :hasMultiplePendingListings="hasMultiplePendingListings"
          :pendingListingsCount="pendingListingsCount"
          :publishAllPending="publishAllPendingDrafts"
          :publish="publishSelectedDraft"
          :cancelPendingChanges="cancelSelectedDraftChanges"
          @patch="applyDraftPatch"
        />
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
              @select="handleSelectListing"
              @preview="showPreview"
              @status-change="applyListingStatusPatch"
            />
          </Transition>

          <Transition name="editor-stage">
            <EditorPreview
              v-show="stage === 'preview'"
              :rawListing="previewRawListing"
              :isLoading="draftStatus.isLoading"
              :isShowed="stage === 'preview'"
              @back="showListings"
            />
          </Transition>
        </div>
      </section>
    </div>
  </main>
</template>

<style lang="scss">
@use '@/views/Editor/editor.scss';
</style>
