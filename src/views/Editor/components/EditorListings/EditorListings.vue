<!-- File: src/views/Editor/components/EditorListings/EditorListings.vue -->

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { normalizeListingStatus } from '@/domain/listings/status'
import { getUserMaxActiveListings } from '@/domain/user/subscription'
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
}>()

const emit = defineEmits<{
  (e: 'select', listingId: string): void
  (e: 'preview', listingId: string): void
  (e: 'status-change', payload: { listingId: string; status: string }): void
}>()

const query = ref('')
const route = useRoute()
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

const maxActiveListings = getUserMaxActiveListings()
const activeListingsCount = computed(() => props.listings.reduce((count, listing) => count + (isActiveListingStatus(listing.status) ? 1 : 0), 0))
const remainingActiveListings = computed(() => Math.max(0, maxActiveListings - activeListingsCount.value))
const isActiveListingsLimitReached = computed(() => remainingActiveListings.value <= 0)
const newListingActiveUsage = computed(() => listingContent.newListing.activeUsage.replace('{count}', String(activeListingsCount.value)).replace('{max}', String(maxActiveListings)))
const newListingRemaining = computed(() => listingContent.newListing.remaining.replace('{count}', String(remainingActiveListings.value)))
const newListingRemainingDisplay = computed(() => (isActiveListingsLimitReached.value ? `${newListingRemaining.value} ${listingContent.newListing.remainingAlertSuffix}` : newListingRemaining.value))

const createListingRoute = computed(() => {
  const userId = route.params.userId
  if (typeof userId === 'string' && userId.trim()) {
    return {
      name: 'create-listing-user',
      params: { userId: userId.trim() },
    }
  }

  return { name: 'create-listing' }
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.listings
  return props.listings.filter((item) => (item.title ?? '').toLowerCase().includes(q))
})

const openStatusMenuListingId = ref<string | null>(null)

function handleSelect(listingId: string) {
  emit('select', listingId)
}

function handlePreview(listingId: string) {
  emit('preview', listingId)
}

function setListingStatus(payload: { listingId: string; status: string }) {
  closeStatusMenu()
  emit('status-change', payload)
}

function isStatusMenuOpen(listingId: string) {
  return openStatusMenuListingId.value === listingId
}

function closeStatusMenu() {
  openStatusMenuListingId.value = null
}

function toggleStatusMenu(listingId: string) {
  openStatusMenuListingId.value = openStatusMenuListingId.value === listingId ? null : listingId
}

function handleStatusMenuDocumentPointerDown(event: PointerEvent) {
  const target = event.target
  if (!(target instanceof Element)) {
    closeStatusMenu()
    return
  }

  if (target.closest('.status-menu')) return
  closeStatusMenu()
}

function handleStatusMenuDocumentKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  closeStatusMenu()
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
          :statusOptions="STATUS_OPTIONS"
          :listingContent="listingContent"
          @select="handleSelect"
          @preview="handlePreview"
          @toggle-status-menu="toggleStatusMenu"
          @close-status-menu="closeStatusMenu"
          @status-change="setListingStatus"
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
  </section>
</template>

<style lang="scss">
@use '@/views/Editor/components/EditorListings/editor-listings.scss';
</style>
