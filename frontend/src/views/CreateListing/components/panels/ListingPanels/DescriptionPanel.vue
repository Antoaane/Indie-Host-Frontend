<!-- File: src/views/CreateListing/components/panels/ListingPanels/DescriptionPanel.vue -->

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Loader2, Sparkles } from 'lucide-vue-next'
import { useAuth } from '@clerk/vue'
import type { RawCore } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import { formatValidationMessage, plainTextLengthFromHtml } from '@/utils/inputValidation'
import { applyQuillToolbarTitles } from '@/utils/quillToolbarA11y'
import { generateAiDescription } from '@/domain/api/aiDescription'

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

const editor = ref<InstanceType<typeof QuillyEditor>>()
const content = ref(description.value)
let quill: Quill | undefined
const descriptionValidation = editorStatic.validation.listing.description
const quillLengthLimit = descriptionValidation.maxPlainText + 1
const plainTextLength = ref(plainTextLengthFromHtml(content.value))

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
  '--create-ql-text': `'${panelContent.toolbar.text}'`,
  '--create-ql-title': `'${panelContent.toolbar.title}'`,
}))

const { getToken } = useAuth()
const isGenerating = ref(false)
const generateError = ref<string | null>(null)
const descriptionLength = ref(2)

async function handleGenerateDescription() {
  if (isGenerating.value || !props.core) return
  isGenerating.value = true
  generateError.value = null
  try {
    const html = await generateAiDescription(props.core, descriptionLength.value, getToken.value)
    content.value = html
  } catch (err) {
    const msg = (err as { response?: { data?: { message?: string }; status?: number }; message?: string })
    generateError.value = msg?.response?.data?.message ?? msg?.message ?? 'Erreur inconnue'
  } finally {
    isGenerating.value = false
  }
}

onMounted(() => {
  quill = editor.value?.initialize(Quill)
  applyQuillToolbarTitles(quill, {
    text: panelContent.toolbar.text,
    title: panelContent.toolbar.title,
  })
  trimContentToLimit()
  plainTextLength.value = plainTextLengthFromHtml(content.value)
})
</script>

<template>
  <section class="create-description-panel">
    <div class="header">
      <h2>{{ panelContent.title }}</h2>
      <h3>{{ panelContent.subtitle }}</h3>
    </div>

    <div class="toolbar">
      <div class="length-control">
        <span class="length-label">Courte</span>
        <input
          type="range"
          min="1"
          max="3"
          step="1"
          v-model.number="descriptionLength"
          class="length-slider"
          aria-label="Longueur de la description"
        />
        <span class="length-label">Longue</span>
      </div>
      <button
        class="ai-btn"
        type="button"
        aria-label="Générer la description avec l'IA"
        :disabled="isGenerating"
        @click="handleGenerateDescription"
      >
        <Loader2 v-if="isGenerating" :size="16" class="spin" />
        <Sparkles v-else :size="16" />
        <span>{{ isGenerating ? 'Génération…' : 'Générer' }}</span>
      </button>
    </div>
    <p v-if="generateError" class="generate-error">{{ generateError }}</p>

    <div
      class="body"
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
        ref="editor"
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
  </section>
</template>

<style lang="scss">
/* File: src/views/CreateListing/components/panels/ListingPanels/description-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/animations' as animations;
@use '@/styles/components/inputs' as inputs;
@use '@/views/CreateListing/components/panels/panel.scss' as *;

@keyframes spin {
  to { transform: rotate(360deg); }
}

.spin {
  animation: spin 0.8s linear infinite;
}

.create-description-panel {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--layout-gap-sm);
    margin-bottom: var(--layout-gap-sm);

    > .length-control {
      display: flex;
      align-items: center;
      gap: var(--layout-gap-sm);
      flex: 1 1 auto;
      min-width: 0;

      > .length-label {
        @include little-text($thin: true);
        color: rgba($secondary-text, 0.6);
        white-space: nowrap;
        flex-shrink: 0;
      }

      > .length-slider {
        flex: 1 1 auto;
        min-width: 0;
        height: 4px;
        appearance: none;
        background: rgba($secondary, 0.15);
        border-radius: borders.$rounded;
        outline: none;
        cursor: pointer;
        @include animations.transition();

        &::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: borders.$rounded;
          background: $secondary;
          cursor: pointer;
          @include animations.transition();
        }

        &::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border: none;
          border-radius: borders.$rounded;
          background: $secondary;
          cursor: pointer;
        }

        @include on-hover('::-webkit-slider-thumb') {
          background: rgba($secondary, 0.75);
        }
      }
    }

    > .ai-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.45rem 0.75rem;
      border: 1px solid rgba($secondary, 0.18);
      border-radius: borders.$rounded;
      background: $accent;
      cursor: pointer;
      color: $secondary;
      @include little-text($thin: false);
      @include animations.transition(animations.$duration-fast);
      @include animations.press();
      white-space: nowrap;

      @include on-hover(':not(:disabled)') {
        background: $accent-surface-3;
        border-color: rgba($secondary, 0.3);
      }

      @media (pointer: coarse) {
        min-height: 2.75rem;
      }

      &:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
    }
  }

  > .generate-error {
    margin: 0 0 var(--layout-gap-sm);
    @include little-text($thin: false);
    color: $bad-ink;
  }

  > .body {
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
          content: var(--create-ql-text);
        }

        .ql-picker-item[data-value='2']::before {
          content: var(--create-ql-title);
        }

        .ql-picker-label::before {
          content: var(--create-ql-text);
        }

        .ql-picker-label[data-value='2']::before {
          content: var(--create-ql-title);
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

        @include on-hover {
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
        @include animations.press();

        svg {
          * {
            stroke: $secondary !important;

            @include animations.transition($duration: 150ms);
          }
        }

        @include on-hover {
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
      display: flex;
      flex-direction: column;

      > .ql-editor {
        flex: 1 1 auto;
        min-height: clamp(12rem, 36svh, 22rem);
        max-height: min(58svh, 34rem);
        overflow-y: auto;
      }
    }

    > .meta {
      margin: 0;
      @include little-text($thin: true);
      color: rgba($secondary-text, 0.58);

      &.is-warning {
        color: #9c6b00;
      }

      &.is-error {
        color: #b3261e;
      }
    }
  }
}
</style>
