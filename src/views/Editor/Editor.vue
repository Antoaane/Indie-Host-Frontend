<!-- File: src/views/Editor/Editor.vue -->

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import EditorListings from '@/views/Editor/components/EditorListings/EditorListings.vue'
import EditorSidebar from '@/views/Editor/components/EditorSidebar/EditorSidebar.vue'
import EditorPreview from '@/views/Editor/components/EditorPreview/EditorPreview.vue'

import type { RawListingBundle } from '@/views/ListingView/utils/useParseContent'
import { fetchListingDraft } from '@/views/Editor/utils/fetchListingDraft'
import type { DraftPatch, VolatileBundle, UserListingCard } from '@/views/Editor/utils/listingApi'
import { persistListingDraft } from '@/views/Editor/utils/persistListingDraft'
import type { EditorMode, EditorSource } from '@/views/Editor/types/editor'

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

function applyDraftPatch(patch: DraftPatch) {
  if (!draft.value) draft.value = {}
  if (patch.core) {
    draft.value.core = {
      ...(draft.value.core ?? {}),
      ...patch.core,
    }
  }
  if (patch.medias) {
    draft.value.medias = {
      ...(draft.value.medias ?? {}),
      ...patch.medias,
    }
  }
}

async function loadListings() {
  listingsStatus.isLoading = true
  listingsStatus.error = null

  try {
    listings.value = await props.source.fetchListings()
  } catch (err) {
    listingsStatus.error = err
    listings.value = []
  } finally {
    listingsStatus.isLoading = false
  }
}

async function ensureDraft(listingId: string) {
  draftStatus.isLoading = true
  draftStatus.error = null

  try {
    const localDraft = fetchListingDraft(listingId)
    if (localDraft) {
      draft.value = localDraft
      return
    }

    const fetched = await props.source.fetchEditableListingBundle(listingId)
    draft.value = fetched
    persistListingDraft(listingId, fetched)
  } catch (err) {
    draftStatus.error = err
    throw err
  } finally {
    draftStatus.isLoading = false
  }
}

async function ensureVolatile(listingId: string) {
  volatileCache[listingId] = await props.source.fetchVolatileListingBundle(listingId)
}

async function handleSelectListing(listingId: string) {
  if (!listingId.trim()) return

  selectedListingId.value = listingId
  stage.value = 'listings'

  draft.value = null
  await Promise.all([
    ensureDraft(listingId),
    ensureVolatile(listingId),
  ])
}

function showPreview() {
  if (!selectedListingId.value || !draft.value) return
  stage.value = 'preview'
}

function showListings() {
  stage.value = 'listings'
}

const canTogglePreview = computed(() => Boolean(selectedListingId.value && draft.value))

watch(
  () => props.source,
  () => {
    selectedListingId.value = null
    draft.value = null
    stage.value = 'listings'
    listings.value = []
    void loadListings()
  },
  { immediate: true },
)

watch(selectedListingId, (id) => {
  if (!id) {
    draft.value = null
    stage.value = 'listings'
  }
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
              Afficher l'éditeur
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
              Retourner aux annonces
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
