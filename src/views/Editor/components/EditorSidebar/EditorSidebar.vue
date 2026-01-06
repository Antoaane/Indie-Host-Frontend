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
import { editorStatic } from '@/views/Editor/utils/editorContent'

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
const sidebarContent = editorStatic.sidebar

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
    error.value = err?.message ?? sidebarContent.errors.save
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
    error.value = err?.message ?? sidebarContent.errors.publish
  } finally {
    isPublishing.value = false
  }
}
</script>

<template>
  <aside class="editor-sidebar">
    <div class="header">
      <EditorSidebarNav v-model="tab" />
    </div>

    <div class="body">
      <Transition
        name="editor-sidebar-panels"
        mode="out-in"
      >
        <ListingPanels
          v-if="tab === 'listing'"
          :draft="props.draft"
          @patch="handlePatch"
        />
        <PricingPanels
          v-else-if="tab === 'pricing'"
          :draft="props.draft"
          @patch="handlePatch"
        />
        <ArrivalPanels v-else />
      </Transition>
    </div>

    <div class="footer">
      <p
        v-if="error"
        class="error"
      >
        {{ error }}
      </p>
      <div class="actions">
        <div class="btn-primary__black__full">
          <button
            type="button"
            :disabled="!canInteract"
            @click="saveDraft"
          >
            {{ sidebarContent.actions.save }}
          </button>
        </div>
        <div class="btn-primary__white__full">
          <button
            type="button"
            :disabled="!canInteract"
            @click="publishDraft"
          >
            {{ sidebarContent.actions.apply }}
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/editor-sidebar.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/effects' as effects;

.editor-sidebar {
  flex: 0 0 auto;
  min-width: 0;

  display: flex;
  flex-direction: column;

  @include effects.big-shadow();

  @include min-width(lg) {
    min-width: 24rem;
    max-width: 36rem;
    width: 30vw;
  }

  > .header {
    padding-bottom: var(--layout-gap-md);
  }

  > .body {
    // margin: var(--layout-gap-sm) 0;
    min-height: 0;

    flex: 1 1 auto;
    overflow: auto;
    scrollbar-width: none;

    border-radius: borders.$rounded-xl;
  }

  > .footer {
    flex: 0 0 auto;
    padding: var(--layout-gap-sm) 0;
    background: rgba($secondary, 0.04);
    border-top: 1px solid rgba($secondary, 0.08);

    > .actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--layout-gap-sm);
    }

    > .error {
      margin: 0 0 var(--layout-gap-sm) 0;
      font-size: 0.9rem;
      font-weight: 500;
      color: rgba($bad, 0.95);
    }
  }
}

.editor-sidebar-panels-enter-active,
.editor-sidebar-panels-leave-active {
  transition: opacity 160ms ease;
}

.editor-sidebar-panels-enter-from,
.editor-sidebar-panels-leave-to {
  opacity: 0;
}

.editor-sidebar-panels-enter-to,
.editor-sidebar-panels-leave-from {
  opacity: 1;
}
</style>
