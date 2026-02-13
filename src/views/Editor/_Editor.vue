<!-- File: src/views/Editor/_Editor.vue -->

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'

import EditorListings from '@/views/Editor/components/EditorListings/EditorListings.vue'
import EditorSidebar from '@/views/Editor/components/EditorSidebar/EditorSidebar.vue'
import EditorPreview from '@/views/Editor/components/EditorPreview/EditorPreview.vue'
import { editorStatic } from '@/views/Editor/utils/editorContent'

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
const selectionToken = ref(0)
const loadToken = ref(0)

const volatileForSelection = computed<VolatileBundle | null>(() => {
  if (!selectedListingId.value) return null
  return volatileCache[selectedListingId.value] ?? null
})

const previewRawListing = computed<RawListingBundle | null>(() => {
  if (!draft.value) return null
  const vol = volatileForSelection.value ?? {}
  return {
    ...vol,
    ...draft.value,
  }
})

function mergeDraftPatch(base: DraftPatch | null, patch: DraftPatch): DraftPatch {
  const next: DraftPatch = { ...(base ?? {}) }

  const mergeDeep = (target: any, source: any): any => {
    if (source === null || source === undefined) return source
    if (Array.isArray(source)) return source
    if (typeof source !== 'object') return source

    const baseValue = (target && typeof target === 'object' && !Array.isArray(target)) ? target : {}
    const merged: Record<string, any> = { ...baseValue }

    Object.entries(source as Record<string, any>).forEach(([key, value]) => {
      if (Array.isArray(value) || value === null || typeof value !== 'object') {
        merged[key] = value
      } else {
        merged[key] = mergeDeep(baseValue[key], value)
      }
    })

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

  if (selectedListingId.value === listingId) {
    selectedListingId.value = null
    draft.value = null
    stage.value = 'listings'
    if (listings.value.length) {
      void handleSelectListing(listings.value[0].listingId, { force: true })
    }
  }
}

async function flushPatchQueue() {
  const queued = patchQueue.value
  const listingId = patchListingId.value

  patchQueue.value = null
  patchListingId.value = null

  if (patchTimer.value) {
    window.clearTimeout(patchTimer.value)
    patchTimer.value = null
  }

  if (!queued || !listingId) return

  console.log('[Editor] persist draft patch', { listingId, patch: queued })
  try {
    await props.source.patchListingDraft(listingId, queued)
    if (draft.value && selectedListingId.value === listingId) {
      persistListingDraft(listingId, draft.value)
    }
  } catch (err) {
    console.log('[Editor] patch persistence error', err)
  }
}

function queuePatchPersistence(listingId: string, patch: DraftPatch) {
  if (patchListingId.value && patchListingId.value !== listingId) {
    void flushPatchQueue()
  }

  patchListingId.value = listingId
  patchQueue.value = mergeDraftPatch(patchQueue.value, patch)

  if (patchTimer.value) {
    window.clearTimeout(patchTimer.value)
  }

  patchTimer.value = window.setTimeout(() => {
    void flushPatchQueue()
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

      const baseValue = (target && typeof target === 'object' && !Array.isArray(target)) ? target : {}
      const merged: Record<string, any> = { ...baseValue }

      Object.entries(source as Record<string, any>).forEach(([key, value]) => {
        if (Array.isArray(value) || value === null || typeof value !== 'object') {
          merged[key] = value
        } else {
          merged[key] = mergeDeep(baseValue[key], value)
        }
      })

      return merged
    }

    draft.value.arrival = mergeDeep(draft.value.arrival, patch.arrival)
  }

  if (selectedListingId.value) {
    console.log('[Editor] apply patch', { listingId: selectedListingId.value, patch })
    queuePatchPersistence(selectedListingId.value, patch)
    applyPatchToListingCard(selectedListingId.value, patch)

    if (patch.core?.status && normalizeListingStatus(patch.core.status) === 'deleted') {
      handleDeletedListing(selectedListingId.value)
    }
  }
}

function resetVolatileCache() {
  Object.keys(volatileCache).forEach((key) => {
    delete volatileCache[key]
  })
}

async function loadListings() {
  listingsStatus.isLoading = true
  listingsStatus.error = null

  const token = ++loadToken.value
  console.log('[Editor] loadListings start', { token })

  try {
    const nextListings = await props.source.fetchListings()
    if (token !== loadToken.value) return
    listings.value = nextListings
    console.log('[Editor] loadListings success', { count: nextListings.length })
  } catch (err) {
    if (token !== loadToken.value) return
    listingsStatus.error = err
    listings.value = []
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
    if (selectedListingId.value === listingId) {
      draft.value = fetched
      persistListingDraft(listingId, fetched)
    }
  } catch (err) {
    const localDraft = fetchListingDraft(listingId)
    if (localDraft && selectedListingId.value === listingId) {
      draft.value = localDraft
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
  if (!listingId.trim()) return

  if (!options?.force && listingId === selectedListingId.value && draft.value) {
    console.log('[Editor] handleSelectListing skip (already selected)', { listingId })
    return
  }

  const token = ++selectionToken.value
  selectedListingId.value = listingId
  stage.value = 'listings'
  console.log('[Editor] handleSelectListing', { listingId, token })

  draft.value = null
  await Promise.all([
    ensureDraft(listingId),
    ensureVolatile(listingId),
  ])

  if (token !== selectionToken.value) {
    console.log('[Editor] handleSelectListing stale', { listingId, token })
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
  const nextId = hasCurrent ? current : (listings.value[0]?.listingId ?? null)

  if (nextId) {
    await handleSelectListing(nextId, { force: true })
  }
}

function showPreview() {
  if (!selectedListingId.value || !draft.value) return
  stage.value = 'preview'
}

function showListings() {
  stage.value = 'listings'
}

const canTogglePreview = computed(() => Boolean(selectedListingId.value && draft.value))
const staticContent = editorStatic

watch(
  () => props.source,
  () => {
    console.log('[Editor] source changed, reset state')
    selectedListingId.value = null
    draft.value = null
    stage.value = 'listings'
    listings.value = []
    resetVolatileCache()
    patchQueue.value = null
    patchListingId.value = null
    if (patchTimer.value) {
      window.clearTimeout(patchTimer.value)
      patchTimer.value = null
    }
    void initializeEditorState()
  },
  { immediate: true },
)

watch(selectedListingId, (id) => {
  if (!id) {
    draft.value = null
    stage.value = 'listings'
  }
})

onBeforeUnmount(() => {
  void flushPatchQueue()
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
          :publish="props.source.publishListingDraft"
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
            />
          </Transition>

          <Transition name="editor-stage">
            <EditorPreview
              v-show="stage === 'preview'"
              :rawListing="previewRawListing"
              :isLoading="draftStatus.isLoading"
              :isShowed="stage === 'preview'"
            />
          </Transition>
        </div>

        <footer class="footer">
          <div
            v-if="stage === 'listings'"
            class="btn-primary__black__full"
          >
            <button
              :disabled="!canTogglePreview"
              type="button"
              @click="showPreview"
            >
              {{ staticContent.actions.showEditor }}
            </button>
          </div>
          <div
            v-else
            class="btn-primary__black__full"
          >
            <button
              type="button"
              @click="showListings"
            >
              {{ staticContent.actions.backToListings }}
            </button>
          </div>
        </footer>
      </section>
    </div>
  </main>
</template>

<style lang="scss">
@use '@/views/Editor/editor.scss';
</style>
