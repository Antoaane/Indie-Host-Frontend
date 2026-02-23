<!-- File: src/views/Editor/_Editor.vue -->

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import EditorListings from '@/views/Editor/components/EditorListings/EditorListings.vue'
import EditorSidebar from '@/views/Editor/components/EditorSidebar/EditorSidebar.vue'
import EditorPreview from '@/views/Editor/components/EditorPreview/EditorPreview.vue'

import type { RawListingBundle } from '@/domain/listings/types'
import { fetchListingDraft } from '@/views/Editor/utils/fetchListingDraft'
import type { DraftPatch, VolatileBundle, UserListingCard } from '@/views/Editor/utils/listingApi'
import { persistListingDraft } from '@/views/Editor/utils/persistListingDraft'
import type { EditorMode, EditorSource } from '@/views/Editor/types/editor'
import { normalizeListingStatus } from '@/domain/listings/status'

type EditorStage = 'listings' | 'preview'

const props = defineProps<{
  mode: EditorMode
  source: EditorSource
}>()
const route = useRoute()

const stage = ref<EditorStage>('listings')
const selectedListingId = ref<string | null>(null)

const draft = ref<RawListingBundle | null>(null)
const draftStatus = reactive({
  isLoading: false,
  error: null as unknown,
})

const listings = ref<UserListingCard[]>([])
const listingsStatus = reactive({
  isLoading: false,
  error: null as unknown,
})

const volatileCache = reactive<Record<string, VolatileBundle>>({})
const patchQueue = ref<DraftPatch | null>(null)
const patchTimer = ref<number | null>(null)
const patchListingId = ref<string | null>(null)
const patchSyncTask = ref<Promise<void> | null>(null)
const isPatchSyncing = ref(false)
const selectionToken = ref(0)
const loadToken = ref(0)
const sourceToken = ref(0)
const draftSnapshotByListingId = reactive<Record<string, RawListingBundle>>({})
const publishedSnapshotByListingId = reactive<Record<string, RawListingBundle>>({})

const volatileForSelection = computed<VolatileBundle | null>(() => {
  if (!selectedListingId.value) return null
  return volatileCache[selectedListingId.value] ?? null
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

const isPatchSyncPending = computed(
  () => Boolean(isPatchSyncing.value || patchQueue.value || patchTimer.value || patchSyncTask.value),
)

function mergeDraftPatch(base: DraftPatch | null, patch: DraftPatch): DraftPatch {
  const next: DraftPatch = { ...(base ?? {}) }

  const mergeDeep = (target: any, source: any): any => {
    if (source === null || source === undefined) return source
    if (Array.isArray(source)) return source
    if (typeof source !== 'object') return source

    const baseValue = target && typeof target === 'object' && !Array.isArray(target) ? target : {}
    const merged: Record<string, any> = { ...baseValue }

    Object.entries(source as Record<string, any>).forEach(
      ([
        key,
        value,
      ]) => {
        if (Array.isArray(value) || value === null || typeof value !== 'object') {
          merged[key] = value
        } else {
          merged[key] = mergeDeep(baseValue[key], value)
        }
      },
    )

    return merged
  }

  if (patch.core) {
    next.core = { ...(next.core ?? {}), ...patch.core }
  }

  if (patch.bookings) {
    next.bookings = { ...(next.bookings ?? {}), ...patch.bookings }
  }

  if (patch.medias) {
    next.medias = { ...(next.medias ?? {}), ...patch.medias }
  }

  if (patch.arrival) {
    next.arrival = mergeDeep(next.arrival, patch.arrival)
  }

  return next
}

function snapshotListingDraft(bundle: RawListingBundle): RawListingBundle {
  return JSON.parse(
    JSON.stringify({
      core: bundle.core ?? null,
      bookings: bundle.bookings ?? null,
      medias: bundle.medias ?? null,
      arrival: bundle.arrival ?? null,
      notes: bundle.notes ?? null,
      comments: bundle.comments ?? null,
      host: bundle.host ?? null,
    }),
  ) as RawListingBundle
}

function snapshotListingStatus(status?: string): RawListingBundle {
  const normalized = normalizeListingStatus(status)
  if (!normalized) return snapshotListingDraft({})
  return snapshotListingDraft({ core: { status: normalized } })
}

function areListingDraftsEqual(left?: RawListingBundle | null, right?: RawListingBundle | null): boolean {
  return JSON.stringify(snapshotListingDraft(left ?? {})) === JSON.stringify(snapshotListingDraft(right ?? {}))
}

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

function handleDeletedListing(listingId: string) {
  console.log('[Editor] listing deleted', { listingId })
  removeListingFromList(listingId)
  delete draftSnapshotByListingId[listingId]
  delete publishedSnapshotByListingId[listingId]

  if (selectedListingId.value === listingId) {
    selectedListingId.value = null
    draft.value = null
    stage.value = 'listings'
    if (listings.value.length) {
      void handleSelectListing(listings.value[0].listingId, { force: true })
    }
  }
}

function clearPatchTimer() {
  if (patchTimer.value) {
    window.clearTimeout(patchTimer.value)
    patchTimer.value = null
  }
}

type PatchDrainOptions = {
  throwOnError?: boolean
  source?: EditorSource
}

async function flushPatchQueueOnce(options?: PatchDrainOptions): Promise<boolean> {
  const shouldThrow = options?.throwOnError === true
  const source = options?.source ?? props.source
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
    console.log('[Editor] persist draft patch', { listingId, patch: queued })
    isPatchSyncing.value = true
    try {
      await source.patchListingDraft(listingId, queued)
    } catch (err) {
      console.log('[Editor] patch persistence error', err)
      if (shouldThrow) throw err
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

async function drainPatchQueue(options?: PatchDrainOptions) {
  while (patchQueue.value || patchSyncTask.value || patchTimer.value) {
    const didFlush = await flushPatchQueueOnce(options)
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

function applyDraftPatch(patch: DraftPatch) {
  if (!draft.value) draft.value = {}
  if (patch.core) {
    draft.value.core = {
      ...(draft.value.core ?? {}),
      ...patch.core,
    }
  }
  if (patch.bookings) {
    draft.value.bookings = {
      ...(draft.value.bookings ?? {}),
      ...patch.bookings,
    }
  }
  if (patch.medias) {
    draft.value.medias = {
      ...(draft.value.medias ?? {}),
      ...patch.medias,
    }
  }
  if (patch.arrival) {
    const mergeDeep = (target: any, source: any): any => {
      if (source === null || source === undefined) return source
      if (Array.isArray(source)) return source
      if (typeof source !== 'object') return source

      const baseValue = target && typeof target === 'object' && !Array.isArray(target) ? target : {}
      const merged: Record<string, any> = { ...baseValue }

      Object.entries(source as Record<string, any>).forEach(
        ([
          key,
          value,
        ]) => {
          if (Array.isArray(value) || value === null || typeof value !== 'object') {
            merged[key] = value
          } else {
            merged[key] = mergeDeep(baseValue[key], value)
          }
        },
      )

      return merged
    }

    draft.value.arrival = mergeDeep(draft.value.arrival, patch.arrival)
  }

  const listingId = selectedListingId.value
  if (listingId) {
    console.log('[Editor] apply patch', { listingId, patch })
    const draftSnapshot = snapshotListingDraft(draft.value)
    persistListingDraft(listingId, draftSnapshot)
    draftSnapshotByListingId[listingId] = draftSnapshot
    syncListingPendingChanges(listingId)
    queuePatchPersistence(listingId, patch)
    applyPatchToListingCard(listingId, patch)

    if (patch.core?.status && normalizeListingStatus(patch.core.status) === 'deleted') {
      handleDeletedListing(listingId)
    }
  }
}

function applyListingStatusPatch(payload: { listingId: string; status: string }) {
  const listingId = payload.listingId.trim()
  const normalizedStatus = normalizeListingStatus(payload.status)
  if (!listingId || !normalizedStatus) return

  const currentListing = listings.value.find((item) => item.listingId === listingId)
  const currentStatus = normalizeListingStatus(currentListing?.status)
  if (currentStatus === normalizedStatus) return

  if (!publishedSnapshotByListingId[listingId]) {
    publishedSnapshotByListingId[listingId] = snapshotListingStatus(currentListing?.status)
  }

  const patch: DraftPatch = { core: { status: normalizedStatus } }

  if (selectedListingId.value === listingId && draft.value) {
    draft.value.core = {
      ...(draft.value.core ?? {}),
      status: normalizedStatus,
    }

    const draftSnapshot = snapshotListingDraft(draft.value)
    draftSnapshotByListingId[listingId] = draftSnapshot
    persistListingDraft(listingId, draftSnapshot)
  } else {
    const baseDraft = draftSnapshotByListingId[listingId] ?? snapshotListingStatus(currentListing?.status)
    draftSnapshotByListingId[listingId] = snapshotListingDraft({
      ...baseDraft,
      core: {
        ...(baseDraft.core ?? {}),
        status: normalizedStatus,
      },
    })
  }

  console.log('[Editor] apply listing status patch', { listingId, status: normalizedStatus })
  applyPatchToListingCard(listingId, patch)
  syncListingPendingChanges(listingId)
  queuePatchPersistence(listingId, patch)

  if (normalizedStatus === 'deleted') {
    handleDeletedListing(listingId)
  }
}

function resetVolatileCache() {
  Object.keys(volatileCache).forEach((key) => {
    delete volatileCache[key]
  })
}

function resetDraftSnapshots() {
  Object.keys(draftSnapshotByListingId).forEach((key) => {
    delete draftSnapshotByListingId[key]
  })
  Object.keys(publishedSnapshotByListingId).forEach((key) => {
    delete publishedSnapshotByListingId[key]
  })
}

function normalizeQueryParam(value: unknown): string | null {
  if (Array.isArray(value)) return normalizeQueryParam(value[0])
  if (typeof value === 'string' && value.trim()) return value.trim()
  return null
}

async function loadListings() {
  listingsStatus.isLoading = true
  listingsStatus.error = null

  const token = ++loadToken.value
  console.log('[Editor] loadListings start', { token })

  try {
    const nextListings = await props.source.fetchListings()
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

async function ensureDraft(listingId: string) {
  draftStatus.isLoading = true
  draftStatus.error = null

  try {
    const fetched = await props.source.fetchEditableListingBundle(listingId)
    const fetchedSnapshot = snapshotListingDraft(fetched)
    const previousDraftSnapshot = draftSnapshotByListingId[listingId]
    const publishedSnapshot = publishedSnapshotByListingId[listingId]

    if (!publishedSnapshot || areListingDraftsEqual(previousDraftSnapshot, publishedSnapshot)) {
      publishedSnapshotByListingId[listingId] = snapshotListingDraft(fetchedSnapshot)
    }
    draftSnapshotByListingId[listingId] = fetchedSnapshot
    syncListingPendingChanges(listingId)

    if (selectedListingId.value === listingId) {
      draft.value = fetchedSnapshot
      persistListingDraft(listingId, fetchedSnapshot)
    }
  } catch (err) {
    const localDraft = fetchListingDraft(listingId)
    if (localDraft && selectedListingId.value === listingId) {
      const localSnapshot = snapshotListingDraft(localDraft)
      if (!publishedSnapshotByListingId[listingId]) {
        publishedSnapshotByListingId[listingId] = snapshotListingDraft(localSnapshot)
      }
      draftSnapshotByListingId[listingId] = localSnapshot
      syncListingPendingChanges(listingId)
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
  volatileCache[listingId] = await props.source.fetchVolatileListingBundle(listingId)
}

async function handleSelectListing(listingId: string, options?: { force?: boolean }) {
  const normalizedListingId = listingId.trim()
  if (!normalizedListingId) return

  if (!options?.force && normalizedListingId === selectedListingId.value && draft.value) {
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
    await drainPatchQueue()
    if (token !== selectionToken.value) {
      console.log('[Editor] handleSelectListing stale after drain', { listingId: normalizedListingId, token })
      return
    }
  }

  selectedListingId.value = normalizedListingId
  stage.value = 'listings'
  console.log('[Editor] handleSelectListing', { listingId: normalizedListingId, token })

  draft.value = null
  await Promise.all([
    ensureDraft(normalizedListingId),
    ensureVolatile(normalizedListingId),
  ])

  if (token !== selectionToken.value) {
    console.log('[Editor] handleSelectListing stale', { listingId: normalizedListingId, token })
  }
}

async function initializeEditorState() {
  console.log('[Editor] initializeEditorState')
  await loadListings()

  if (!listings.value.length) {
    selectedListingId.value = null
    return
  }

  const current = selectedListingId.value
  const hasCurrent = current ? listings.value.some((item) => item.listingId === current) : false
  const routeListingId = normalizeQueryParam(route.query.listingId)
  const hasRouteListing = routeListingId ? listings.value.some((item) => item.listingId === routeListingId) : false
  const nextId = hasRouteListing ? routeListingId : hasCurrent ? current : (listings.value[0]?.listingId ?? null)

  if (nextId) {
    await handleSelectListing(nextId, { force: true })
  }
}

async function showPreview(listingId: string) {
  const normalizedListingId = listingId.trim()
  if (!normalizedListingId) return

  await handleSelectListing(normalizedListingId)
  if (selectedListingId.value !== normalizedListingId || !draft.value) return

  stage.value = 'preview'
}

function showListings() {
  stage.value = 'listings'
}

async function publishSelectedDraft() {
  const listingId = selectedListingId.value
  if (!listingId || !draft.value) return

  await drainPatchQueue({ throwOnError: true })
  if (selectedListingId.value !== listingId || !draft.value) return

  const snapshot = snapshotListingDraft(draft.value)
  await props.source.publishListingDraft(listingId, snapshot)
  publishedSnapshotByListingId[listingId] = snapshotListingDraft(snapshot)
  draftSnapshotByListingId[listingId] = snapshotListingDraft(snapshot)
  syncListingPendingChanges(listingId)
  persistListingDraft(listingId, snapshot)
}

watch(
  () => props.source,
  (nextSource, previousSource) => {
    const token = ++sourceToken.value
    void (async () => {
      const sourceForDrain = previousSource ?? nextSource
      await drainPatchQueue({ source: sourceForDrain })

      if (token !== sourceToken.value) return

      console.log('[Editor] source changed, reset state')
      selectedListingId.value = null
      draft.value = null
      stage.value = 'listings'
      listings.value = []
      resetVolatileCache()
      resetDraftSnapshots()
      patchQueue.value = null
      patchListingId.value = null
      patchSyncTask.value = null
      isPatchSyncing.value = false
      clearPatchTimer()
      await initializeEditorState()
    })()
  },
  { immediate: true },
)

watch(selectedListingId, (id) => {
  if (!id) {
    draft.value = null
    stage.value = 'listings'
  }
})

watch(
  () => route.query.listingId,
  (value) => {
    const listingId = normalizeQueryParam(value)
    if (!listingId) return
    if (!listings.value.some((item) => item.listingId === listingId)) return
    if (listingId === selectedListingId.value && draft.value) return
    void handleSelectListing(listingId)
  },
)

onBeforeUnmount(() => {
  void drainPatchQueue()
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
          :publish="publishSelectedDraft"
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
