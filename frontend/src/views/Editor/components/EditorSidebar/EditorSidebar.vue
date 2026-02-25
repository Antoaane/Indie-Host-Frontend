<!-- File: src/views/Editor/components/EditorSidebar/EditorSidebar.vue -->

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import BaseSidebar from '@/components/layouts/BaseSidebar.vue'
import EditorSidebarNav from '@/views/Editor/components/EditorSidebar/EditorSidebarNav.vue'
import ListingPanels from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/ListingPanels.vue'
import PricingPanels from '@/views/Editor/components/EditorSidebar/panels/PricingPanels/PricingPanels.vue'
import ArrivalPanels from '@/views/Editor/components/EditorSidebar/panels/ArrivalPanels/ArrivalPanels.vue'
import type { RawListingBundle } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'

type SidebarTab = 'listing' | 'pricing' | 'arrival'
type SuccessFeedback = 'publish' | null

const props = defineProps<{
  listingId: string
  draft: RawListingBundle
  isLoading?: boolean
  isPatchSyncing?: boolean
  hasPendingChanges?: boolean
  publish: () => Promise<void>
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const tab = ref<SidebarTab>('listing')

const isPublishing = ref(false)
const error = ref<string | null>(null)
const successFeedback = ref<SuccessFeedback>(null)
const successTimer = ref<number | null>(null)
const sidebarContent = editorStatic.sidebar

const canPublish = computed(() => !props.isLoading && !isPublishing.value && Boolean(props.hasPendingChanges))
const isActionRunning = computed(() => isPublishing.value)

function handlePatch(patch: DraftPatch) {
  emit('patch', patch)
}

function clearSuccessFeedback() {
  if (successTimer.value) {
    window.clearTimeout(successTimer.value)
    successTimer.value = null
  }
  successFeedback.value = null
}

function showSuccessFeedback() {
  clearSuccessFeedback()
  successFeedback.value = 'publish'
  successTimer.value = window.setTimeout(() => {
    successFeedback.value = null
    successTimer.value = null
  }, 2200)
}

watch(
  () => props.listingId,
  () => {
    tab.value = 'listing'
    error.value = null
    clearSuccessFeedback()
  },
)

async function publishDraft() {
  if (!canPublish.value) return
  error.value = null

  isPublishing.value = true
  try {
    await props.publish()
    showSuccessFeedback()
  } catch (err: any) {
    error.value = err?.message ?? sidebarContent.errors.publish
  } finally {
    isPublishing.value = false
  }
}

onBeforeUnmount(() => {
  clearSuccessFeedback()
})
</script>

<template>
  <BaseSidebar
    class="editor-sidebar"
    :class="{ 'is-action-running': isActionRunning }"
    body-scrollable
  >
    <template #header>
      <Transition name="editor-sidebar-feedback">
        <p
          v-if="successFeedback"
          class="action-feedback"
          role="status"
          aria-live="polite"
        >
          {{ sidebarContent.success.publish }}
        </p>
      </Transition>

      <EditorSidebarNav v-model="tab" />
    </template>

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
      <ArrivalPanels
        v-else
        :core="props.draft.core"
        :arrival="props.draft.arrival"
        @patch="handlePatch"
      />
    </Transition>

    <template
      #footer
      v-if="props.hasPendingChanges"
    >
      <p
        v-if="error"
        class="error"
      >
        {{ error }}
      </p>
      <p
        v-if="props.isPatchSyncing"
        class="sync-status"
        role="status"
        aria-live="polite"
      >
        {{ sidebarContent.sync.pending }}
      </p>
      <div class="actions">
        <div class="btn">
          <button
            type="button"
            :disabled="!canPublish"
            @click="publishDraft"
          >
            {{ sidebarContent.actions.apply }}
          </button>
        </div>
      </div>
    </template>
  </BaseSidebar>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/editor-sidebar.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/components/buttons' as buttons;

.editor-sidebar {
  position: relative;

  .action-feedback {
    margin: 0;
    padding: 0.45rem 0.75rem;

    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    z-index: 5;

    border-radius: borders.$rounded-sm;
    background-color: rgba($good, 0.92);
    color: $secondary;

    font-size: 0.8rem;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: 0.01em;

    pointer-events: none;
  }

  > .base-sidebar__body {
    border-radius: borders.$rounded-xl;
  }

  > .base-sidebar__footer {
    width: 100%;
    padding: var(--layout-gap-md);
    padding-top: var(--layout-gap-xl);

    position: absolute;
    bottom: 0;
    left: 0;
    z-index: 99;

    background: linear-gradient(to bottom, rgba($accent, 0) 0%, $accent 25%, $accent 100%);
    // border-bottom-left-radius: borders.$rounded-xl;
    // border-bottom-right-radius: borders.$rounded-xl;
    border-radius: borders.$rounded-xl;

    > .actions {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--layout-gap-sm);

      & > .btn {
        @include buttons.primary($cta: true, $theme: dark, $fullwidth: true);
      }
    }

    > .error {
      margin: 0 0 var(--layout-gap-sm) 0;
      font-size: 0.9rem;
      font-weight: 500;
      color: rgba($bad, 0.95);
    }

    > .sync-status {
      margin: 0 0 var(--layout-gap-sm) 0;
      font-size: 0.86rem;
      font-weight: 600;
      color: rgba($secondary, 0.7);
    }
  }

  &.is-action-running {
    > .base-sidebar__header,
    > .base-sidebar__body {
      pointer-events: none;
      user-select: none;
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

.editor-sidebar-feedback-enter-active,
.editor-sidebar-feedback-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.editor-sidebar-feedback-enter-from,
.editor-sidebar-feedback-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.editor-sidebar-feedback-enter-to,
.editor-sidebar-feedback-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
