<!-- File: src/views/Editor/components/EditorSidebar/EditorSidebar.vue -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import EditorSidebarNav from '@/views/Editor/components/EditorSidebar/EditorSidebarNav.vue'
import ListingPanels from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/ListingPanels.vue'
import PricingPanels from '@/views/Editor/components/EditorSidebar/panels/PricingPanels/PricingPanels.vue'
import ArrivalPanels from '@/views/Editor/components/EditorSidebar/panels/ArrivalPanels/ArrivalPanels.vue'
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

watch(
  () => props.listingId,
  () => {
    tab.value = 'listing'
  },
)

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
    <div class="editor-sidebar__header">
      <EditorSidebarNav v-model="tab" />
    </div>

    <div class="editor-sidebar__body">
      <Transition
        name="editor-sidebar-panels"
        mode="out-in"
      >
        <ListingPanels
          v-if="tab === 'listing'"
          :draft="props.draft"
          @patch="handlePatch"
        />
        <PricingPanels v-else-if="tab === 'pricing'" />
        <ArrivalPanels v-else />
      </Transition>
    </div>

    <div class="editor-sidebar__footer">
      <p
        v-if="error"
        class="editor-sidebar__error"
      >
        {{ error }}
      </p>
      <div class="editor-sidebar__actions">
        <div class="btn-primary__black__full">
          <button
            type="button"
            :disabled="!canInteract"
            @click="saveDraft"
          >
            Sauvegarder
          </button>
        </div>
        <div class="btn-primary__white__full">
          <button
            type="button"
            :disabled="!canInteract"
            @click="publishDraft"
          >
            Appliquer
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>
