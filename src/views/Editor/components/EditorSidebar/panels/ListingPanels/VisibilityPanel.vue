<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/VisibilityPanel.vue -->

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { RawCore } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import { getListingStatusFlags } from '@/domain/listings/status'

const props = defineProps<{
  core?: Partial<RawCore> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const panelContent = editorStatic.panels.listing.visibility

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
  set: (value: string) => emit('patch', { core: { pause_message: value } }),
})

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

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isDeleteOverlayOpen.value) {
    closeDeleteOverlay()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
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
        />
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

    <Transition name="editor-visibility-overlay">
      <div
        v-if="isDeleteOverlayOpen"
        class="editor-visibility-overlay"
        role="dialog"
        aria-modal="true"
        @click.self="closeDeleteOverlay"
      >
        <div class="panel">
          <div class="header">
            <h2>{{ panelContent.delete.confirmTitle }}</h2>
          </div>
          <div class="body">
            <p>{{ panelContent.delete.confirmMessage }}</p>
          </div>
          <div class="footer">
            <button
              type="button"
              class="ghost"
              @click="closeDeleteOverlay"
            >
              {{ panelContent.delete.cancelCta }}
            </button>
            <button
              type="button"
              class="danger"
              @click="confirmDelete"
            >
              {{ panelContent.delete.confirmCta }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </section>
</template>

<style lang="scss">
@use '@/views/Editor/components/EditorSidebar/panels/ListingPanels/visibility-panel.scss';
</style>
