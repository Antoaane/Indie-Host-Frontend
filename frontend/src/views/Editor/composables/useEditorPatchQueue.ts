// File: src/views/Editor/composables/useEditorPatchQueue.ts

import { computed, ref } from 'vue'

import { mergeDraftPatch } from '@/views/Editor/composables/editorDraftTools'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'

export type PatchDrainOptions = {
  throwOnError?: boolean
}

export function useEditorPatchQueue() {
  const patchQueue = ref<DraftPatch | null>(null)
  const patchTimer = ref<number | null>(null)
  const patchListingId = ref<string | null>(null)
  const patchSyncTask = ref<Promise<void> | null>(null)
  const isPatchSyncing = ref(false)

  const isPatchSyncPending = computed(
    () => Boolean(isPatchSyncing.value || patchQueue.value || patchTimer.value || patchSyncTask.value),
  )

  function clearPatchTimer() {
    if (patchTimer.value) {
      window.clearTimeout(patchTimer.value)
      patchTimer.value = null
    }
  }

  async function flushPatchQueueOnce(drainOptions?: PatchDrainOptions): Promise<boolean> {
    const shouldThrow = drainOptions?.throwOnError === true
    clearPatchTimer()

    if (patchSyncTask.value) {
      try {
        await patchSyncTask.value
      } catch (err) {
        if (shouldThrow) throw err
      }
    }

    const queued = patchQueue.value
    const listingId = patchListingId.value

    patchQueue.value = null
    patchListingId.value = null

    if (!queued || !listingId) return false

    const task = (async () => {
      console.log('[Editor] flush local draft patch queue', { listingId, patch: queued })
      isPatchSyncing.value = true
      try {
        // Local-first draft lifecycle: snapshots and local storage are updated at patch time.
        // The queue only debounces UI sync state and serializes patch batches.
      } catch (error) {
        if (shouldThrow) throw error
      } finally {
        isPatchSyncing.value = false
      }
    })()

    patchSyncTask.value = task

    try {
      await task
    } finally {
      if (patchSyncTask.value === task) {
        patchSyncTask.value = null
      }
    }

    return true
  }

  async function drainPatchQueue(drainOptions?: PatchDrainOptions) {
    while (patchQueue.value || patchSyncTask.value || patchTimer.value) {
      const didFlush = await flushPatchQueueOnce(drainOptions)
      if (!didFlush && !patchQueue.value && !patchSyncTask.value) return
    }
  }

  function queuePatchPersistence(listingId: string, patch: DraftPatch) {
    if (patchListingId.value && patchListingId.value !== listingId) {
      const deferredPatch = mergeDraftPatch(null, patch)
      console.log('[Editor] queuePatchPersistence deferred (pending listing mismatch)', {
        incomingListingId: listingId,
        queuedListingId: patchListingId.value,
      })

      void (async () => {
        await drainPatchQueue()
        queuePatchPersistence(listingId, deferredPatch)
      })()
      return
    }

    patchListingId.value = listingId
    patchQueue.value = mergeDraftPatch(patchQueue.value, patch)

    if (patchTimer.value) {
      window.clearTimeout(patchTimer.value)
    }

    patchTimer.value = window.setTimeout(() => {
      void flushPatchQueueOnce()
    }, 350)
  }

  function resetPatchQueueState() {
    patchQueue.value = null
    patchListingId.value = null
    patchSyncTask.value = null
    isPatchSyncing.value = false
    clearPatchTimer()
  }

  return {
    drainPatchQueue,
    flushPatchQueueOnce,
    queuePatchPersistence,
    resetPatchQueueState,
    isPatchSyncPending,
  }
}
