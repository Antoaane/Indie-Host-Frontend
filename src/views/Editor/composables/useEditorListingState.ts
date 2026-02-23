// File: src/views/Editor/composables/useEditorListingState.ts

import { reactive, ref } from 'vue'

import type { RawListingBundle } from '@/domain/listings/types'
import {
  areListingDraftsEqual,
  snapshotListingStatus,
} from '@/views/Editor/composables/editorDraftTools'
import type { EditorSource } from '@/views/Editor/types/editor'
import type { DraftPatch, UserListingCard } from '@/views/Editor/utils/listingApi'

export function useEditorListingState(options: { getSource: () => EditorSource }) {
  const listings = ref<UserListingCard[]>([])
  const listingsStatus = reactive({
    isLoading: false,
    error: null as unknown,
  })

  const loadToken = ref(0)
  const draftSnapshotByListingId = reactive<Record<string, RawListingBundle>>({})
  const publishedSnapshotByListingId = reactive<Record<string, RawListingBundle>>({})

  function setListingPendingChangesFlag(listingId: string, hasPendingChanges: boolean) {
    const index = listings.value.findIndex((item) => item.listingId === listingId)
    if (index < 0) return

    const current = listings.value[index]
    if (Boolean(current.hasPendingChanges) === hasPendingChanges) return

    listings.value.splice(index, 1, {
      ...current,
      hasPendingChanges,
    })
  }

  function syncListingPendingChanges(listingId: string) {
    const draftSnapshot = draftSnapshotByListingId[listingId]
    const publishedSnapshot = publishedSnapshotByListingId[listingId]
    const hasPendingChanges = !areListingDraftsEqual(draftSnapshot, publishedSnapshot)
    setListingPendingChangesFlag(listingId, hasPendingChanges)
  }

  function hydrateListingStatusSnapshots(listing: UserListingCard) {
    const listingId = listing.listingId
    if (!listingId) return

    if (!publishedSnapshotByListingId[listingId]) {
      publishedSnapshotByListingId[listingId] = snapshotListingStatus(listing.status)
    }

    if (!draftSnapshotByListingId[listingId]) {
      draftSnapshotByListingId[listingId] = snapshotListingStatus(listing.status)
    }

    syncListingPendingChanges(listingId)
  }

  function applyPatchToListingCard(listingId: string, patch: DraftPatch) {
    const index = listings.value.findIndex((item) => item.listingId === listingId)
    if (index < 0) return

    const current = listings.value[index]
    const next = { ...current }

    if (patch.core) {
      if (typeof patch.core.title === 'string') next.title = patch.core.title
      if (typeof patch.core.status === 'string') next.status = patch.core.status
      if (typeof patch.core.guest_capacity === 'number') next.guestCapacity = patch.core.guest_capacity
    }

    if (patch.bookings) {
      if (typeof patch.bookings.price === 'number') next.pricePerNight = patch.bookings.price
    }

    if (patch.medias?.images) {
      next.images = patch.medias.images as UserListingCard['images']
      next.coverSrc = patch.medias.images?.[0]?.src
    }

    listings.value.splice(index, 1, next)
  }

  function removeListingFromList(listingId: string) {
    const index = listings.value.findIndex((item) => item.listingId === listingId)
    if (index >= 0) {
      listings.value.splice(index, 1)
    }
  }

  function removeListingState(listingId: string) {
    removeListingFromList(listingId)
    delete draftSnapshotByListingId[listingId]
    delete publishedSnapshotByListingId[listingId]
  }

  function resetDraftSnapshots() {
    Object.keys(draftSnapshotByListingId).forEach((key) => {
      delete draftSnapshotByListingId[key]
    })
    Object.keys(publishedSnapshotByListingId).forEach((key) => {
      delete publishedSnapshotByListingId[key]
    })
  }

  function resetListings() {
    listings.value = []
  }

  async function loadListings() {
    listingsStatus.isLoading = true
    listingsStatus.error = null

    const token = ++loadToken.value
    console.log('[Editor] loadListings start', { token })

    try {
      const nextListings = await options.getSource().fetchListings()
      if (token !== loadToken.value) return
      const listingIds = new Set(nextListings.map((item) => item.listingId))

      Object.keys(draftSnapshotByListingId).forEach((listingId) => {
        if (!listingIds.has(listingId)) delete draftSnapshotByListingId[listingId]
      })
      Object.keys(publishedSnapshotByListingId).forEach((listingId) => {
        if (!listingIds.has(listingId)) delete publishedSnapshotByListingId[listingId]
      })

      listings.value = nextListings.map((listing) => ({
        ...listing,
        hasPendingChanges: false,
      }))
      listings.value.forEach((listing) => {
        hydrateListingStatusSnapshots(listing)
      })
      console.log('[Editor] loadListings success', { count: nextListings.length })
    } catch (err) {
      if (token !== loadToken.value) return
      listingsStatus.error = err
      listings.value = []
      resetDraftSnapshots()
      console.log('[Editor] loadListings error', err)
    } finally {
      if (token === loadToken.value) {
        listingsStatus.isLoading = false
      }
    }
  }

  return {
    listings,
    listingsStatus,
    draftSnapshotByListingId,
    publishedSnapshotByListingId,
    applyPatchToListingCard,
    loadListings,
    removeListingState,
    resetDraftSnapshots,
    resetListings,
    syncListingPendingChanges,
  }
}
