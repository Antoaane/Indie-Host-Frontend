<!-- File: src/views/Editor/components/EditorSidebar/EditorSidebar.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'

import EditorPanels from '@/views/Editor/components/EditorPanels/EditorPanels.vue'
import type { RawListingBundle } from '@/views/ListingView/utils/useParseContent'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { persistListingDraft } from '@/views/Editor/utils/persistListingDraft'

type SidebarTab = 'listing' | 'pricing' | 'arrival'

const props = defineProps<{
  listingId: string
  draft: RawListingBundle
  isLoading?: boolean
  publish: (listingId: string, draft: RawListingBundle) => Promise<void>
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const tab = ref<SidebarTab>('listing')

const isSaving = ref(false)
const isPublishing = ref(false)
const error = ref<string | null>(null)

const canInteract = computed(() => !props.isLoading && !isSaving.value && !isPublishing.value)

function handlePatch(patch: DraftPatch) {
  emit('patch', patch)
}

async function saveDraft() {
  if (!canInteract.value) return
  error.value = null

  isSaving.value = true
  try {
    persistListingDraft(props.listingId, props.draft)
  } catch (err: any) {
    error.value = err?.message ?? 'Erreur lors de la sauvegarde.'
  } finally {
    isSaving.value = false
  }
}

async function publishDraft() {
  if (!canInteract.value) return
  error.value = null

  isPublishing.value = true
  try {
    await props.publish(props.listingId, props.draft)
  } catch (err: any) {
    error.value = err?.message ?? 'Erreur lors de la publication.'
  } finally {
    isPublishing.value = false
  }
}
</script>

<template>
  <aside class="editor-sidebar">
    <header class="editor-sidebar__header">
      <nav class="editor-sidebar__tabs">
        <button
          class="editor-sidebar__tab"
          :class="{ 'is-active': tab === 'listing' }"
          type="button"
          @click="tab = 'listing'"
        >
          Annonce
        </button>
        <button
          class="editor-sidebar__tab"
          :class="{ 'is-active': tab === 'pricing' }"
          type="button"
          @click="tab = 'pricing'"
        >
          Tarification
        </button>
        <button
          class="editor-sidebar__tab"
          :class="{ 'is-active': tab === 'arrival' }"
          type="button"
          @click="tab = 'arrival'"
        >
          Arrivée
        </button>
      </nav>
    </header>

    <div class="editor-sidebar__body">
      <EditorPanels
        v-if="tab === 'listing'"
        :draft="props.draft"
        @patch="handlePatch"
      />
      <div
        v-else
        class="editor-sidebar__placeholder"
      >
        Section en cours de construction.
      </div>
    </div>

    <footer class="editor-sidebar__footer">
      <p
        v-if="error"
        class="editor-sidebar__error"
      >
        {{ error }}
      </p>
      <div class="editor-sidebar__actions">
        <button
          class="btn-primary__black"
          type="button"
          :disabled="!canInteract"
          @click="saveDraft"
        >
          Sauvegarder
        </button>
        <button
          class="btn-primary__white"
          type="button"
          :disabled="!canInteract"
          @click="publishDraft"
        >
          Appliquer
        </button>
      </div>
    </footer>
  </aside>
</template>
