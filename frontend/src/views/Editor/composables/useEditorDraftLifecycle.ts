// File: src/views/Editor/composables/useEditorDraftLifecycle.ts

import { computed, reactive, ref, type Ref } from 'vue'

import type { RawListingBundle } from '@/domain/listings/types'
import { fetchListingDraft } from '@/views/Editor/utils/fetchListingDraft'
import { persistListingDraft } from '@/views/Editor/utils/persistListingDraft'
import type { EditorSource } from '@/views/Editor/types/editor'
import type { VolatileBundle } from '@/views/Editor/utils/listingApi'
import {
  areListingDraftsEqual,
  snapshotListingDraft,
} from '@/views/Editor/composables/editorDraftTools'

type DraftLifecycleOptions = {
  getSource: () => EditorSource
  selectedListingId: Ref<string | null>
  draftSnapshotByListingId: Record<string, RawListingBundle>
  publishedSnapshotByListingId: Record<string, RawListingBundle>
  syncListingPendingChanges: (listingId: string) => void
}

export function useEditorDraftLifecycle(options: DraftLifecycleOptions) {
  const draft = ref<RawListingBundle | null>(null)
  const draftStatus = reactive({
    isLoading: false,
    error: null as unknown,
  })

  const volatileCache = reactive<Record<string, VolatileBundle>>({})

  const volatileForSelection = computed<VolatileBundle | null>(() => {
    const listingId = options.selectedListingId.value
    if (!listingId) return null
    return volatileCache[listingId] ?? null
  })

  const previewRawListing = computed<RawListingBundle | null>(() => {
    if (!draft.value) return null
    const vol = volatileForSelection.value

    const mergedBookings = (draft.value.bookings || vol?.bookings)
      ? {
        ...(vol?.bookings ?? {}),
        ...(draft.value.bookings ?? {}),
      }
      : null

    return {
      core: draft.value.core ?? null,
      bookings: mergedBookings,
      medias: draft.value.medias ?? null,
      arrival: draft.value.arrival ?? null,
      notes: vol?.notes ?? draft.value.notes ?? null,
      comments: vol?.comments ?? draft.value.comments ?? null,
      host: vol?.host ?? draft.value.host ?? null,
    }
  })

  async function ensureDraft(listingId: string) {
    draftStatus.isLoading = true
    draftStatus.error = null

    try {
      const fetched = await options.getSource().fetchEditableListingBundle(listingId)
      const fetchedSnapshot = snapshotListingDraft(fetched)
      const previousDraftSnapshot = options.draftSnapshotByListingId[listingId]
      const publishedSnapshot = options.publishedSnapshotByListingId[listingId]

      if (!publishedSnapshot || areListingDraftsEqual(previousDraftSnapshot, publishedSnapshot)) {
        options.publishedSnapshotByListingId[listingId] = snapshotListingDraft(fetchedSnapshot)
      }
      options.draftSnapshotByListingId[listingId] = fetchedSnapshot
      options.syncListingPendingChanges(listingId)

      if (options.selectedListingId.value === listingId) {
        draft.value = fetchedSnapshot
        persistListingDraft(listingId, fetchedSnapshot)
      }
    } catch (err) {
      const localDraft = fetchListingDraft(listingId)
      if (localDraft && options.selectedListingId.value === listingId) {
        const localSnapshot = snapshotListingDraft(localDraft)
        if (!options.publishedSnapshotByListingId[listingId]) {
          options.publishedSnapshotByListingId[listingId] = snapshotListingDraft(localSnapshot)
        }
        options.draftSnapshotByListingId[listingId] = localSnapshot
        options.syncListingPendingChanges(listingId)
        draft.value = localSnapshot
        console.log('[Editor] fallback to local draft', { listingId })
        return
      }
      draftStatus.error = err
      throw err
    } finally {
      draftStatus.isLoading = false
    }
  }

  async function ensureVolatile(listingId: string) {
    console.log('[Editor] ensureVolatile', { listingId })
    volatileCache[listingId] = await options.getSource().fetchVolatileListingBundle(listingId)
  }

  function resetVolatileCache() {
    Object.keys(volatileCache).forEach((key) => {
      delete volatileCache[key]
    })
  }

  return {
    draft,
    draftStatus,
    previewRawListing,
    ensureDraft,
    ensureVolatile,
    resetVolatileCache,
  }
}
