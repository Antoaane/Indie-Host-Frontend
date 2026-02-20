<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/VisibilityPanel.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { RawCore } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import { getListingStatusFlags } from '@/domain/listings/status'
import ConfirmationDialog from '@/components/overlays/ConfirmationDialog.vue'
import { formatValidationMessage, normalizeTextInput } from '@/utils/inputValidation'

const props = defineProps<{
  core?: Partial<RawCore> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const panelContent = editorStatic.panels.listing.visibility
const visibilityValidation = editorStatic.validation.listing.visibility
const pauseMessageMax = visibilityValidation.pauseMessageMax

const statusFlags = computed(() => getListingStatusFlags(props.core?.status))
const currentStatus = computed(() => statusFlags.value.normalized || 'published')

const selectedState = computed({
  get: () => {
    if (statusFlags.value.isPaused) return 'paused'
    if (statusFlags.value.isBlocked) return 'blocked'
    return 'active'
  },
  set: (value: 'active' | 'blocked' | 'paused') => {
    if (value === 'blocked') {
      emit('patch', { core: { status: 'blocked' } })
      return
    }
    if (value === 'paused') {
      emit('patch', { core: { status: 'paused' } })
      return
    }
    emit('patch', { core: { status: 'published' } })
  },
})

const pauseMessage = computed({
  get: () => (props.core?.pause_message as string | undefined) ?? '',
  set: (value: string) => {
    const next = normalizeTextInput(value, pauseMessageMax)
    if (next === ((props.core?.pause_message as string | undefined) ?? '')) return
    emit('patch', { core: { pause_message: next } })
  },
})
const pauseMessageLength = computed(() => Math.min(pauseMessage.value.length, pauseMessageMax))
const pauseMessageCounter = computed(() =>
  formatValidationMessage(visibilityValidation.messages.counter, {
    current: pauseMessageLength.value,
    max: pauseMessageMax,
  }),
)

const isDeleteOverlayOpen = ref(false)

function openDeleteOverlay() {
  isDeleteOverlayOpen.value = true
}

function closeDeleteOverlay() {
  isDeleteOverlayOpen.value = false
}

function confirmDelete() {
  emit('patch', { core: { status: 'deleted' } })
  closeDeleteOverlay()
}
</script>

<template>
  <section class="editor-visibility-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
      <div class="status">
        <p class="label">{{ panelContent.statusLabel }}</p>
        <p class="hint">{{ panelContent.statusHint }}</p>

        <div class="options">
          <label class="option">
            <input
              v-model="selectedState"
              type="radio"
              value="active"
            />
            <span class="text">
              <span class="title">{{ panelContent.options.active.title }}</span>
              <span class="desc">{{ panelContent.options.active.description }}</span>
            </span>
          </label>
          <label class="option">
            <input
              v-model="selectedState"
              type="radio"
              value="blocked"
            />
            <span class="text">
              <span class="title">{{ panelContent.options.blocked.title }}</span>
              <span class="desc">{{ panelContent.options.blocked.description }}</span>
            </span>
          </label>
          <label class="option">
            <input
              v-model="selectedState"
              type="radio"
              value="paused"
            />
            <span class="text">
              <span class="title">{{ panelContent.options.paused.title }}</span>
              <span class="desc">{{ panelContent.options.paused.description }}</span>
            </span>
          </label>
        </div>
      </div>

      <div class="pause-message">
        <p class="hint">{{ panelContent.pauseMessage.hint }}</p>
        <textarea
          v-model="pauseMessage"
          rows="4"
          :placeholder="panelContent.pauseMessage.placeholder"
          :maxlength="pauseMessageMax"
          autocomplete="off"
          inputmode="text"
        />
        <p class="meta">{{ pauseMessageCounter }}</p>
      </div>

      <div class="delete">
        <div class="danger">
          <button
            type="button"
            @click="openDeleteOverlay"
          >
            {{ panelContent.delete.cta }}
          </button>
        </div>
      </div>
    </div>

    <ConfirmationDialog
      :open="isDeleteOverlayOpen"
      :level="2"
      :subject="panelContent.delete.title"
      :title="panelContent.delete.confirmTitle"
      :message="panelContent.delete.confirmMessage"
      :confirm-label="panelContent.delete.confirmCta"
      :cancel-label="panelContent.delete.cancelCta"
      typing-hint="Tapez &quot;supprimer&quot; pour confirmer la suppression de cette annonce."
      @close="closeDeleteOverlay"
      @cancel="closeDeleteOverlay"
      @confirm="confirmDelete"
    />
  </section>
</template>

<style lang="scss">
@use '@/views/Editor/components/EditorSidebar/panels/ListingPanels/visibility-panel.scss';
</style>
