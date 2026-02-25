// File: src/views/Editor/composables/useEditorController.ts

import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'

import { normalizeListingStatus } from '@/domain/listings/status'
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
import { persistListingDraft } from '@/views/Editor/utils/persistListingDraft'

export type EditorStage = 'listings' | 'preview'

type EditorControllerOptions = {
  route: RouteLocationNormalizedLoaded
  source: Ref<EditorSource>
}

export function useEditorController(options: EditorControllerOptions) {
  const stage = ref<EditorStage>('listings')
  const selectedListingId = ref<string | null>(null)
  const selectionToken = ref(0)
  const sourceToken = ref(0)

  const listingState = useEditorListingState({
    getSource: () => options.source.value,
  })

  const patchQueue = useEditorPatchQueue({
    getSource: () => options.source.value,
  })

  const selectedListingHasPendingChanges = computed(() => {
    const listingId = selectedListingId.value
    if (!listingId) return false
    const selectedListing = listingState.listings.value.find((item) => item.listingId === listingId)
    return Boolean(selectedListing?.hasPendingChanges)
  })

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
      console.log('[Editor] handleSelectListing drain pending patches before switch', {
        from: previousListingId,
        to: normalizedListingId,
        token,
      })
      await patchQueue.drainPatchQueue()
      if (token !== selectionToken.value) {
        console.log('[Editor] handleSelectListing stale after drain', { listingId: normalizedListingId, token })
        return
      }
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

  function applyListingStatusPatch(payload: { listingId: string; status: string }) {
    const listingId = payload.listingId.trim()
    const normalizedStatus = normalizeListingStatus(payload.status)
    if (!listingId || !normalizedStatus) return

    const currentListing = listingState.listings.value.find((item) => item.listingId === listingId)
    const currentStatus = normalizeListingStatus(currentListing?.status)
    if (currentStatus === normalizedStatus) return

    if (!listingState.publishedSnapshotByListingId[listingId]) {
      listingState.publishedSnapshotByListingId[listingId] = snapshotListingStatus(currentListing?.status)
    }

    const patch: DraftPatch = { core: { status: normalizedStatus } }

    if (selectedListingId.value === listingId && draftLifecycle.draft.value) {
      draftLifecycle.draft.value.core = {
        ...(draftLifecycle.draft.value.core ?? {}),
        status: normalizedStatus,
      }

      const draftSnapshot = snapshotListingDraft(draftLifecycle.draft.value)
      listingState.draftSnapshotByListingId[listingId] = draftSnapshot
      persistListingDraft(listingId, draftSnapshot)
    } else {
      const baseDraft = listingState.draftSnapshotByListingId[listingId] ?? snapshotListingStatus(currentListing?.status)
      listingState.draftSnapshotByListingId[listingId] = snapshotListingDraft({
        ...baseDraft,
        core: {
          ...(baseDraft.core ?? {}),
          status: normalizedStatus,
        },
      })
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
    persistListingDraft(listingId, snapshot)
  }

  watch(
    () => options.source.value,
    (nextSource, previousSource) => {
      const token = ++sourceToken.value
      void (async () => {
        const sourceForDrain = previousSource ?? nextSource
        await patchQueue.drainPatchQueue({ source: sourceForDrain })

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
    draft: draftLifecycle.draft,
    draftStatus: draftLifecycle.draftStatus,
    handleSelectListing,
    isPatchSyncPending: patchQueue.isPatchSyncPending,
    listings: listingState.listings,
    listingsStatus: listingState.listingsStatus,
    previewRawListing: draftLifecycle.previewRawListing,
    publishSelectedDraft,
    selectedListingId,
    selectedListingHasPendingChanges,
    showListings,
    showPreview,
    stage,
  }
}
