<!-- File: src/views/Editor/components/EditorSidebar/EditorSidebar.vue -->

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import BaseSidebar from '@/components/layouts/BaseSidebar.vue'
import EditorSidebarNav from '@/views/Editor/components/EditorSidebar/EditorSidebarNav.vue'
import ListingPanels from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/ListingPanels.vue'
import PricingPanels from '@/views/Editor/components/EditorSidebar/panels/PricingPanels/PricingPanels.vue'
import ArrivalPanels from '@/views/Editor/components/EditorSidebar/panels/ArrivalPanels/ArrivalPanels.vue'
import type { RawListingBundle } from '@/domain/listings/types'
import type { ListingDomainRecord } from '@/domain/api/listingDomains'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'

type SidebarTab = 'listing' | 'pricing' | 'arrival'
type SuccessFeedback = 'publish' | 'publishAll' | 'cancel' | null

const props = defineProps<{
  listingId: string
  draft: RawListingBundle
  showMobileBack?: boolean
  isLoading?: boolean
  isPatchSyncing?: boolean
  hasPendingChanges?: boolean
  hasAnyPendingChanges?: boolean
  hasMultiplePendingListings?: boolean
  pendingListingsCount?: number
  canPublishListing?: boolean
  isAdmin?: boolean
  publishAllPending: () => Promise<void>
  cancelPendingChanges: () => Promise<void>
  publish: () => Promise<void>
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
  (e: 'domain-updated', domain: ListingDomainRecord): void
  (e: 'mobile-back'): void
}>()

const tab = ref<SidebarTab>('listing')

const isPublishing = ref(false)
const isCancelling = ref(false)
const error = ref<string | null>(null)
const successFeedback = ref<SuccessFeedback>(null)
const successTimer = ref<number | null>(null)
const applyToAllPending = ref(false)
const sidebarContent = editorStatic.sidebar

const showApplyToAllToggle = computed(() => Boolean(props.hasMultiplePendingListings))
const shouldShowFooter = computed(() => Boolean(props.hasPendingChanges))
const canPublish = computed(() => {
  if (props.isLoading || isPublishing.value || isCancelling.value) return false
  if (showApplyToAllToggle.value && applyToAllPending.value) {
    return Boolean(props.hasAnyPendingChanges)
  }
  return Boolean(props.hasPendingChanges)
})
const canCancel = computed(() => !props.isLoading && !isPublishing.value && !isCancelling.value && Boolean(props.hasPendingChanges))
const isActionRunning = computed(() => isPublishing.value || isCancelling.value)
const successFeedbackText = computed(() => {
  if (successFeedback.value === 'publishAll') {
    return sidebarContent.success.publishAll ?? sidebarContent.success.publish
  }
  if (successFeedback.value === 'cancel') {
    return sidebarContent.success.cancel ?? sidebarContent.success.publish
  }
  return sidebarContent.success.publish
})
const applyToAllLabel = computed(() => {
  const count = props.pendingListingsCount ?? 0
  if (count > 1) return `${sidebarContent.actions.applyAllPending} (${count})`
  return sidebarContent.actions.applyAllPending
})

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

function showSuccessFeedback(type: Exclude<SuccessFeedback, null> = 'publish') {
  clearSuccessFeedback()
  successFeedback.value = type
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
    applyToAllPending.value = false
    clearSuccessFeedback()
  },
)

watch(showApplyToAllToggle, (enabled) => {
  if (!enabled) {
    applyToAllPending.value = false
  }
})

async function publishDraft() {
  if (!canPublish.value) return
  error.value = null

  const shouldPublishAll = showApplyToAllToggle.value && applyToAllPending.value

  isPublishing.value = true
  try {
    if (shouldPublishAll) {
      await props.publishAllPending()
      showSuccessFeedback('publishAll')
    } else {
      await props.publish()
      showSuccessFeedback('publish')
    }
  } catch (err: any) {
    error.value = err?.message ?? (shouldPublishAll ? (sidebarContent.errors.publishAll ?? sidebarContent.errors.publish) : sidebarContent.errors.publish)
  } finally {
    isPublishing.value = false
  }
}

async function cancelDraftChanges() {
  if (!canCancel.value) return
  error.value = null

  isCancelling.value = true
  try {
    await props.cancelPendingChanges()
    showSuccessFeedback('cancel')
  } catch (err: any) {
    error.value = err?.message ?? (sidebarContent.errors.cancel ?? sidebarContent.errors.publish)
  } finally {
    isCancelling.value = false
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
          {{ successFeedbackText }}
        </p>
      </Transition>

      <EditorSidebarNav
        v-model="tab"
        :showMobileBack="props.showMobileBack"
        @mobile-back="emit('mobile-back')"
      />
    </template>

    <Transition
      name="editor-sidebar-panels"
      mode="out-in"
    >
      <ListingPanels
        v-if="tab === 'listing'"
        :listing-id="props.listingId"
        :draft="props.draft"
        :canPublishListing="props.canPublishListing"
        :isAdmin="props.isAdmin"
        @patch="handlePatch"
        @domain-updated="emit('domain-updated', $event)"
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

    <template #footer v-if="shouldShowFooter">
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
      <label
        v-if="showApplyToAllToggle"
        class="apply-all-toggle"
      >
        <input
          v-model="applyToAllPending"
          type="checkbox"
          :disabled="isActionRunning || !!props.isLoading"
        >
        <span>{{ applyToAllLabel }}</span>
      </label>
      <div class="actions">
        <div class="btn is-cancel">
          <button
            type="button"
            :disabled="!canCancel"
            @click="cancelDraftChanges"
          >
            {{ sidebarContent.actions.cancel }}
          </button>
        </div>
        <div class="btn is-apply">
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

    > .apply-all-toggle {
      margin: 0 0 var(--layout-gap-sm) 0;
      width: 100%;
      justify-content: flex-start;
      @include buttons.checkbox-label(white);
    }

    > .actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--layout-gap-sm);

      & > .btn.is-apply {
        @include buttons.primary($cta: true, $theme: dark, $fullwidth: true);
      }

      & > .btn.is-cancel {
        @include buttons.primary($theme: white, $fullwidth: true);
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
