// File: src/views/Editor/composables/useEditorController.ts

import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { useRouter, type RouteLocationNormalizedLoaded } from 'vue-router'

import type { RawListingBundle } from '@/domain/listings/types'
import { normalizeListingStatus } from '@/domain/listings/status'
import { fetchMyStripeSubscriptionState } from '@/domain/api/stripeSubscriptions'
import {
  applyPatchToDraftBundle,
  snapshotListingDraft,
  snapshotListingStatus,
} from '@/views/Editor/composables/editorDraftTools'
import { useEditorDraftLifecycle } from '@/views/Editor/composables/useEditorDraftLifecycle'
import { useEditorListingState } from '@/views/Editor/composables/useEditorListingState'
import { useEditorPatchQueue } from '@/views/Editor/composables/useEditorPatchQueue'
import type { EditorSource } from '@/views/Editor/types/editor'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import {
  persistListingDraft,
  persistListingPublishedSnapshot,
} from '@/views/Editor/utils/persistListingDraft'

export type EditorStage = 'listings' | 'preview'

type EditorControllerOptions = {
  route: RouteLocationNormalizedLoaded
  source: Ref<EditorSource>
}

export function useEditorController(options: EditorControllerOptions) {
  const router = useRouter()
  const stage = ref<EditorStage>('listings')
  const selectedListingId = ref<string | null>(null)
  const selectionToken = ref(0)
  const sourceToken = ref(0)

  const listingState = useEditorListingState({
    getSource: () => options.source.value,
  })

  const patchQueue = useEditorPatchQueue({
    persistPatch: async (listingId, patch) => {
      await options.source.value.patchListingDraft(listingId, patch)
    },
  })

  const selectedListingHasPendingChanges = computed(() => {
    const listingId = selectedListingId.value
    if (!listingId) return false
    const selectedListing = listingState.listings.value.find((item) => item.listingId === listingId)
    return Boolean(selectedListing?.hasPendingChanges)
  })
  const pendingListingIds = computed(() =>
    listingState.listings.value
      .filter((listing) => listing.hasPendingChanges)
      .map((listing) => listing.listingId),
  )
  const pendingListingsCount = computed(() => pendingListingIds.value.length)
  const hasAnyPendingChanges = computed(() => pendingListingsCount.value > 0)
  const hasMultiplePendingListings = computed(() => pendingListingsCount.value > 1)

  const draftLifecycle = useEditorDraftLifecycle({
    getSource: () => options.source.value,
    selectedListingId,
    draftSnapshotByListingId: listingState.draftSnapshotByListingId,
    publishedSnapshotByListingId: listingState.publishedSnapshotByListingId,
    syncListingPendingChanges: listingState.syncListingPendingChanges,
  })

  function normalizeQueryParam(value: unknown): string | null {
    if (Array.isArray(value)) return normalizeQueryParam(value[0])
    if (typeof value === 'string' && value.trim()) return value.trim()
    return null
  }

  function handleDeletedListing(listingId: string) {
    console.log('[Editor] listing deleted', { listingId })
    listingState.removeListingState(listingId)

    if (selectedListingId.value === listingId) {
      selectedListingId.value = null
      draftLifecycle.draft.value = null
      stage.value = 'listings'
      if (listingState.listings.value.length) {
        void handleSelectListing(listingState.listings.value[0].listingId, { force: true })
      }
    }
  }

  async function handleSelectListing(listingId: string, selectionOptions?: { force?: boolean }) {
    const normalizedListingId = listingId.trim()
    if (!normalizedListingId) return

    if (!selectionOptions?.force && normalizedListingId === selectedListingId.value && draftLifecycle.draft.value) {
      console.log('[Editor] handleSelectListing skip (already selected)', { listingId: normalizedListingId })
      return
    }

    const token = ++selectionToken.value
    const previousListingId = selectedListingId.value
    if (previousListingId && previousListingId !== normalizedListingId) {
      console.log('[Editor] handleSelectListing drain pending patches in background', {
        from: previousListingId,
        to: normalizedListingId,
        token,
      })
      void patchQueue.drainPatchQueue()
    }

    selectedListingId.value = normalizedListingId
    stage.value = 'listings'
    console.log('[Editor] handleSelectListing', { listingId: normalizedListingId, token })

    draftLifecycle.draft.value = null
    await Promise.all([
      draftLifecycle.ensureDraft(normalizedListingId),
      draftLifecycle.ensureVolatile(normalizedListingId),
    ])

    if (token !== selectionToken.value) {
      console.log('[Editor] handleSelectListing stale', { listingId: normalizedListingId, token })
    }
  }

  async function initializeEditorState() {
    console.log('[Editor] initializeEditorState')
    await listingState.loadListings()

    if (!listingState.listings.value.length) {
      selectedListingId.value = null
      return
    }

    const current = selectedListingId.value
    const hasCurrent = current ? listingState.listings.value.some((item) => item.listingId === current) : false
    const routeListingId = normalizeQueryParam(options.route.query.listingId)
    const hasRouteListing = routeListingId
      ? listingState.listings.value.some((item) => item.listingId === routeListingId)
      : false
    const nextId = hasRouteListing ? routeListingId : hasCurrent ? current : (listingState.listings.value[0]?.listingId ?? null)

    if (nextId) {
      await handleSelectListing(nextId, { force: true })
    }
  }

  function applyDraftPatch(patch: DraftPatch) {
    draftLifecycle.draft.value = applyPatchToDraftBundle(draftLifecycle.draft.value, patch)

    const listingId = selectedListingId.value
    if (listingId) {
      console.log('[Editor] apply patch', { listingId, patch })
      const draftSnapshot = snapshotListingDraft(draftLifecycle.draft.value ?? {})
      persistListingDraft(listingId, draftSnapshot)
      listingState.draftSnapshotByListingId[listingId] = draftSnapshot
      listingState.syncListingPendingChanges(listingId)
      patchQueue.queuePatchPersistence(listingId, patch)
      listingState.applyPatchToListingCard(listingId, patch)

      if (patch.core?.status && normalizeListingStatus(patch.core.status) === 'deleted') {
        handleDeletedListing(listingId)
      }
    }
  }

  async function applyListingStatusPatch(payload: { listingId: string; status: string }) {
    const listingId = payload.listingId.trim()
    const normalizedStatus = normalizeListingStatus(payload.status)
    if (!listingId || !normalizedStatus) return

    const currentListing = listingState.listings.value.find((item) => item.listingId === listingId)
    const currentStatus = normalizeListingStatus(currentListing?.status)
    if (currentStatus === normalizedStatus) return

    if (normalizedStatus === 'published') {
      try {
        const billingState = await fetchMyStripeSubscriptionState({ sync: true })
        if (!billingState.publicationReadiness?.canPublish) {
          const missing = billingState.publicationReadiness?.missingRequirements ?? []
          const detail = missing.length ? ` (${missing.join(', ')})` : ''
          window.alert(`Publication bloquée: abonnement actif + Stripe Connect complet requis${detail}.`)
          await router.push({
            name: 'pricing',
            query: {
              onboarding: 'listing',
              intent: 'publish',
              listingId,
            },
          })
          return
        }
      } catch (error) {
        console.warn('[Editor] failed to validate publication requirements', { listingId, error })
        window.alert('Impossible de vérifier les prérequis de publication pour le moment.')
        return
      }
    }

    if (!listingState.publishedSnapshotByListingId[listingId]) {
      const publishedSnapshot = snapshotListingStatus(currentListing?.status)
      listingState.publishedSnapshotByListingId[listingId] = publishedSnapshot
      persistListingPublishedSnapshot(listingId, publishedSnapshot)
    }

    const patch: DraftPatch = { core: { status: normalizedStatus } }
    const isSelectedListing = selectedListingId.value === listingId

    const selectedDraftSnapshot = isSelectedListing && draftLifecycle.draft.value
      ? snapshotListingDraft(draftLifecycle.draft.value)
      : null
    const baseDraftSnapshot = selectedDraftSnapshot
      ?? listingState.draftSnapshotByListingId[listingId]
      ?? snapshotListingStatus(currentListing?.status)
    const nextDraftSnapshot = snapshotListingDraft(applyPatchToDraftBundle(baseDraftSnapshot, patch))

    listingState.draftSnapshotByListingId[listingId] = nextDraftSnapshot
    persistListingDraft(listingId, nextDraftSnapshot)
    if (isSelectedListing) {
      draftLifecycle.draft.value = snapshotListingDraft(nextDraftSnapshot)
    }

    console.log('[Editor] apply listing status patch', { listingId, status: normalizedStatus })
    listingState.applyPatchToListingCard(listingId, patch)
    listingState.syncListingPendingChanges(listingId)
    patchQueue.queuePatchPersistence(listingId, patch)

    if (normalizedStatus === 'deleted') {
      handleDeletedListing(listingId)
    }
  }

  async function showPreview(listingId: string) {
    const normalizedListingId = listingId.trim()
    if (!normalizedListingId) return

    await handleSelectListing(normalizedListingId)
    if (selectedListingId.value !== normalizedListingId || !draftLifecycle.draft.value) return

    stage.value = 'preview'
  }

  function showListings() {
    stage.value = 'listings'
  }

  function buildDraftPatchFromBundle(bundle: RawListingBundle): DraftPatch {
    const patch: DraftPatch = {}
    if (bundle.core) patch.core = bundle.core
    if (bundle.bookings) patch.bookings = bundle.bookings
    if (bundle.medias) patch.medias = bundle.medias
    if (bundle.arrival) patch.arrival = bundle.arrival
    return patch
  }

  async function publishSelectedDraft() {
    const listingId = selectedListingId.value
    if (!listingId || !draftLifecycle.draft.value) return

    await patchQueue.drainPatchQueue({ throwOnError: true })
    if (selectedListingId.value !== listingId || !draftLifecycle.draft.value) return

    const snapshot = snapshotListingDraft(draftLifecycle.draft.value)
    await options.source.value.publishListingDraft(listingId, snapshot)
    listingState.publishedSnapshotByListingId[listingId] = snapshotListingDraft(snapshot)
    listingState.draftSnapshotByListingId[listingId] = snapshotListingDraft(snapshot)
    listingState.syncListingPendingChanges(listingId)
    persistListingPublishedSnapshot(listingId, snapshot)
    persistListingDraft(listingId, snapshot)
  }

  async function publishAllPendingDrafts() {
    const listingIds = pendingListingIds.value
    if (!listingIds.length) return

    await patchQueue.drainPatchQueue({ throwOnError: true })

    for (const listingId of listingIds) {
      const sourceSnapshot = listingId === selectedListingId.value && draftLifecycle.draft.value
        ? draftLifecycle.draft.value
        : listingState.draftSnapshotByListingId[listingId]
      if (!sourceSnapshot) continue

      const snapshot = snapshotListingDraft(sourceSnapshot)
      await options.source.value.publishListingDraft(listingId, snapshot)
      listingState.publishedSnapshotByListingId[listingId] = snapshotListingDraft(snapshot)
      listingState.draftSnapshotByListingId[listingId] = snapshotListingDraft(snapshot)
      listingState.syncListingPendingChanges(listingId)
      persistListingPublishedSnapshot(listingId, snapshot)
      persistListingDraft(listingId, snapshot)

      if (selectedListingId.value === listingId) {
        draftLifecycle.draft.value = snapshotListingDraft(snapshot)
      }
    }
  }

  async function cancelSelectedDraftChanges() {
    const listingId = selectedListingId.value
    if (!listingId) return

    await patchQueue.drainPatchQueue({ throwOnError: true })

    const publishedSnapshot = listingState.publishedSnapshotByListingId[listingId]
    if (!publishedSnapshot) return

    const snapshot = snapshotListingDraft(publishedSnapshot)
    persistListingPublishedSnapshot(listingId, snapshot)
    const rollbackPatch = buildDraftPatchFromBundle(snapshot)
    if (Object.keys(rollbackPatch).length) {
      listingState.applyPatchToListingCard(listingId, rollbackPatch)
    }

    listingState.draftSnapshotByListingId[listingId] = snapshotListingDraft(snapshot)
    listingState.syncListingPendingChanges(listingId)
    persistListingDraft(listingId, snapshot)

    if (selectedListingId.value === listingId) {
      draftLifecycle.draft.value = snapshotListingDraft(snapshot)
    }
  }

  watch(
    () => options.source.value,
    () => {
      const token = ++sourceToken.value
      void (async () => {
        await patchQueue.drainPatchQueue()

        if (token !== sourceToken.value) return

        console.log('[Editor] source changed, reset state')
        selectedListingId.value = null
        draftLifecycle.draft.value = null
        stage.value = 'listings'
        listingState.resetListings()
        draftLifecycle.resetVolatileCache()
        listingState.resetDraftSnapshots()
        patchQueue.resetPatchQueueState()
        await initializeEditorState()
      })()
    },
    { immediate: true },
  )

  watch(selectedListingId, (id) => {
    if (!id) {
      draftLifecycle.draft.value = null
      stage.value = 'listings'
    }
  })

  watch(
    () => options.route.query.listingId,
    (value) => {
      const listingId = normalizeQueryParam(value)
      if (!listingId) return
      if (!listingState.listings.value.some((item) => item.listingId === listingId)) return
      if (listingId === selectedListingId.value && draftLifecycle.draft.value) return
      void handleSelectListing(listingId)
    },
  )

  onBeforeUnmount(() => {
    void patchQueue.drainPatchQueue()
  })

  return {
    applyDraftPatch,
    applyListingStatusPatch,
    cancelSelectedDraftChanges,
    draft: draftLifecycle.draft,
    draftStatus: draftLifecycle.draftStatus,
    handleSelectListing,
    hasAnyPendingChanges,
    hasMultiplePendingListings,
    isPatchSyncPending: patchQueue.isPatchSyncPending,
    listings: listingState.listings,
    listingsStatus: listingState.listingsStatus,
    pendingListingsCount,
    previewRawListing: draftLifecycle.previewRawListing,
    publishAllPendingDrafts,
    publishSelectedDraft,
    selectedListingId,
    selectedListingHasPendingChanges,
    showListings,
    showPreview,
    stage,
  }
}
