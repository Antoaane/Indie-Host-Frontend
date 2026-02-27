<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/DescriptionPanel.vue -->

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Maximize2, X } from 'lucide-vue-next'
import AbsoluteOverlay from '@/components/overlays/AbsoluteOverlay.vue'
import type { RawCore } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import { formatValidationMessage, plainTextLengthFromHtml } from '@/utils/inputValidation'
import { applyQuillToolbarTitles } from '@/utils/quillToolbarA11y'

import { QuillyEditor } from 'vue-quilly'
import type { QuillOptions } from 'quill/core'
import Quill from 'quill'
import 'quill/dist/quill.bubble.css'
import 'quill/dist/quill.snow.css'

const props = defineProps<{
  core?: Partial<RawCore> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const description = computed({
  get: () => props.core?.description ?? '',
  set: (value: string) => emit('patch', { core: { description: value } }),
})

const inlineEditor = ref<InstanceType<typeof QuillyEditor> | null>(null)
const overlayEditor = ref<InstanceType<typeof QuillyEditor> | null>(null)
const content = ref(description.value)
let quill: Quill | undefined
const descriptionValidation = editorStatic.validation.listing.description
const quillLengthLimit = descriptionValidation.maxPlainText + 1
const plainTextLength = ref(plainTextLengthFromHtml(content.value))
const isFullscreenOpen = ref(false)
const fullscreenOpenAriaLabel = 'Ouvrir la description en plein écran'
const fullscreenCloseAriaLabel = 'Fermer la description en plein écran'
const fullscreenOverlayAriaLabel = 'Description en plein écran'
const overlayTitleId = `editor-description-overlay-title-${Math.random().toString(36).slice(2, 9)}`

watch(description, (value) => {
  if (value !== content.value) {
    content.value = value
  }
  plainTextLength.value = plainTextLengthFromHtml(value)
})

watch(content, (value) => {
  const nextLength = plainTextLengthFromHtml(value)
  plainTextLength.value = nextLength
  if (nextLength > descriptionValidation.maxPlainText) {
    trimContentToLimit()
    return
  }
  if (value !== description.value) {
    description.value = value
  }
})

const hasLengthError = computed(() => plainTextLength.value > descriptionValidation.maxPlainText)
const hasLengthWarning = computed(
  () => plainTextLength.value > 0 && plainTextLength.value < descriptionValidation.minPlainText,
)
const descriptionMeta = computed(() => {
  const current = Math.min(plainTextLength.value, descriptionValidation.maxPlainText)
  if (hasLengthError.value) {
    return formatValidationMessage(descriptionValidation.messages.max, {
      max: descriptionValidation.maxPlainText,
    })
  }
  if (hasLengthWarning.value) {
    return formatValidationMessage(descriptionValidation.messages.minHint, {
      current,
      max: descriptionValidation.maxPlainText,
      min: descriptionValidation.minPlainText,
    })
  }
  return formatValidationMessage(descriptionValidation.messages.counter, {
    current,
    max: descriptionValidation.maxPlainText,
  })
})

function trimContentToLimit() {
  if (!quill) return
  const currentLength = quill.getLength()
  if (currentLength <= quillLengthLimit) return
  quill.deleteText(quillLengthLimit - 1, currentLength - quillLengthLimit, 'silent')
  content.value = quill.root.innerHTML
  plainTextLength.value = plainTextLengthFromHtml(content.value)
}

const options: QuillOptions = {
  theme: 'snow',
  placeholder: editorStatic.panels.listing.description.quillPlaceholder,
  readOnly: false,
  modules: {
    toolbar: [
      [
        {
          header: [
            2,
            false,
          ],
        },
      ],
      [
        'bold',
        'italic',
        'link',
      ],
    ],
  },
}

const panelContent = editorStatic.panels.listing.description
const toolbarLabels = computed(() => ({
  '--editor-ql-text': `'${panelContent.toolbar.text}'`,
  '--editor-ql-title': `'${panelContent.toolbar.title}'`,
}))

function initializeEditor() {
  const currentEditor = isFullscreenOpen.value ? overlayEditor.value : inlineEditor.value
  const instance = currentEditor?.initialize(Quill)
  if (!instance) return
  quill = instance
  applyQuillToolbarTitles(instance, {
    text: panelContent.toolbar.text,
    title: panelContent.toolbar.title,
  })
  trimContentToLimit()
  plainTextLength.value = plainTextLengthFromHtml(content.value)
}

function openFullscreen() {
  isFullscreenOpen.value = true
}

function closeFullscreen() {
  isFullscreenOpen.value = false
}

watch(isFullscreenOpen, async () => {
  await nextTick()
  initializeEditor()
})

onMounted(async () => {
  await nextTick()
  initializeEditor()
})
</script>

<template>
  <section class="editor-description-panel">
    <div class="header">
      <div class="main">
        <h3>{{ panelContent.title }}</h3>
        <p>{{ panelContent.subtitle }}</p>
      </div>

      <div class="actions">
        <button
          type="button"
          :aria-label="fullscreenOpenAriaLabel"
          :title="fullscreenOpenAriaLabel"
          @click="openFullscreen"
        >
          <Maximize2 :size="17" />
        </button>
      </div>
    </div>

    <div
      v-if="!isFullscreenOpen"
      class="body description-editor-shell"
      :style="toolbarLabels"
      :class="{
        'is-error': hasLengthError,
        'is-warning': hasLengthWarning,
      }"
    >
      <!--
      <div class="textarea">
        <textarea
          v-model="description"
          rows="6"
          :placeholder="panelContent.placeholder"
        />
      </div>
      -->
      <QuillyEditor
        ref="inlineEditor"
        :options="options"
        v-model="content"
      />
      <p
        class="meta"
        :class="{
          'is-error': hasLengthError,
          'is-warning': hasLengthWarning,
        }"
      >
        {{ descriptionMeta }}
      </p>
    </div>

    <AbsoluteOverlay
      class="description-overlay"
      :open="isFullscreenOpen"
      mode="centered"
      :aria-label="fullscreenOverlayAriaLabel"
      :aria-labelledby="overlayTitleId"
      @close="closeFullscreen"
    >
      <div class="description-overlay-panel">
        <div class="overlay-header">
          <h4 :id="overlayTitleId">
            {{ panelContent.title }}
          </h4>

          <div class="overlay-close">
            <button
              type="button"
              :aria-label="fullscreenCloseAriaLabel"
              :title="fullscreenCloseAriaLabel"
              @click="closeFullscreen"
            >
              <X :size="18" />
            </button>
          </div>
        </div>

        <div
          class="overlay-body description-editor-shell"
          :style="toolbarLabels"
          :class="{
            'is-error': hasLengthError,
            'is-warning': hasLengthWarning,
          }"
        >
          <QuillyEditor
            ref="overlayEditor"
            :options="options"
            v-model="content"
          />
          <p
            class="meta"
            :class="{
              'is-error': hasLengthError,
              'is-warning': hasLengthWarning,
            }"
          >
            {{ descriptionMeta }}
          </p>
        </div>
      </div>
    </AbsoluteOverlay>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/description-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/animations' as animations;
@use '@/styles/components/buttons' as buttons;
@use '@/styles/components/inputs' as inputs;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-description-panel {
  @extend %panel;

  > .header {
    margin-bottom: var(--layout-gap);

    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--layout-gap-sm);

    > .main {
      min-width: 0;
      flex: 1 1 auto;

      > h3 {
        @extend %panel-title;
      }

      > p {
        @extend %panel-subtitle;
      }
    }

    > .actions {
      @include buttons.low-btn($icon-only: true);
      flex: 0 0 auto;

      > * {
        width: 2.2rem;
        height: 2.2rem;
      }
    }
  }

  > .body {
    max-height: clamp(18rem, 58vh, 28rem);
  }
}

.description-editor-shell {
  @extend %panel-body;
  min-height: 0;
  overflow: hidden;

  > .textarea {
    @include inputs.textarea($theme: base);
  }

  > .ql-toolbar {
    border: 0.5px rgba($secondary, 0.1) solid;
    border-radius: borders.$rounded-md;
    background-color: $accent;

    color: $secondary;

    box-shadow: 0 0 0 0 rgba($accent, 0);

    @include soft-shadow();

    .ql-header {
      .ql-picker-item::before {
        content: var(--editor-ql-text);
      }

      .ql-picker-item[data-value='2']::before {
        content: var(--editor-ql-title);
      }

      .ql-picker-label::before {
        content: var(--editor-ql-text);
      }

      .ql-picker-label[data-value='2']::before {
        content: var(--editor-ql-title);
      }

      * {
        color: $secondary !important;
        @include animations.transition($duration: 150ms);
      }

      svg {
        * {
          stroke: $secondary !important;

          @include animations.transition($duration: 150ms);
        }
      }

      &:hover {
        * {
          color: rgba($secondary, 0.8) !important;
        }

        svg {
          * {
            stroke: rgba($secondary, 0.8) !important;
          }
        }
      }
    }

    button {
      border-radius: borders.$rounded-md;

      @include animations.transition($duration: 150ms);

      svg {
        * {
          stroke: $secondary !important;

          @include animations.transition($duration: 150ms);
        }
      }

      &:hover {
        background-color: $accent-surface-3;
      }

      &.ql-active {
        background-color: $secondary;

        svg {
          * {
            stroke: $accent !important;
          }
        }
      }
    }
  }

  > .ql-container {
    @include inputs.richtext($theme: base);
    min-height: 0;

    > .ql-editor {
      max-height: clamp(11rem, 34vh, 18rem);
      overflow-y: auto;
    }
  }

  > .meta {
    margin: 0;
    @include little-text($thin: false);
    color: rgba($secondary, 0.7);

    &.is-warning {
      color: #9c6b00;
    }

    &.is-error {
      color: #b3261e;
    }
  }
}

.description-overlay {
  align-items: center !important;
  justify-content: center !important;

  > .description-overlay-panel {
    width: min(56rem, 100%);
    min-width: min(34rem, calc(100vw - var(--layout-gap)));
    height: 84vh;
    display: flex;
    flex-direction: column;
    gap: var(--layout-gap);
    padding: var(--layout-gap);
    border-radius: borders.$rounded-xl;
    border: 1px solid rgba($secondary, 0.12);
    background: $accent;
    box-shadow: 0 18px 40px rgba($secondary, 0.2);
  }

  .overlay-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--layout-gap-sm);

    > h4 {
      margin: 0;
      @include h4-title();
    }
  }

  .overlay-close {
    @include buttons.low-btn($icon-only: true);

    > * {
      width: 2.25rem;
      height: 2.25rem;
    }
  }

  .overlay-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;

    > .ql-container {
      flex: 1 1 auto;
      min-height: 0;

      > .ql-editor {
        height: 100%;
        max-height: none;
      }
    }
  }

  // @include min-width(md) {
  //   > .description-overlay-panel {
  //     min-width: 0;
  //     width: calc(100vw - var(--layout-gap));
  //     padding: var(--layout-gap-sm);
  //   }
  // }
}
</style>
