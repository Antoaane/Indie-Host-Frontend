<!-- File: src/views/Editor/components/EditorSidebar/panels/ArrivalPanels/ArrivalHtmlPanel.vue -->

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { RawArrival } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import { formatValidationMessage, plainTextLengthFromHtml } from '@/utils/inputValidation'
import { applyQuillToolbarTitles } from '@/utils/quillToolbarA11y'

import { QuillyEditor } from 'vue-quilly'
import type { QuillOptions } from 'quill/core'
import Quill from 'quill'
import 'quill/dist/quill.bubble.css'
import 'quill/dist/quill.snow.css'

type HtmlSectionKey = 'rules' | 'shops'

const props = defineProps<{
  sectionKey: HtmlSectionKey
  title: string
  subtitle?: string
  label: string
  placeholder: string
  value?: string | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const toolbarContent = editorStatic.panels.listing.description.toolbar
const arrivalValidation = editorStatic.validation.arrival
const contentLimit = arrivalValidation.practicalHtmlMaxPlainText
const contentLengthLimit = contentLimit + 1

const sectionContent = computed({
  get: () => props.value ?? '',
  set: (value: string) => {
    emit('patch', {
      arrival: {
        practical: {
          [props.sectionKey]: value,
        } as Partial<RawArrival['practical']>,
      } as Partial<RawArrival>,
    })
  },
})

const editor = ref<InstanceType<typeof QuillyEditor>>()
const content = ref(sectionContent.value)
let quill: Quill | undefined
const sectionContentLength = ref(plainTextLengthFromHtml(content.value))

watch(sectionContent, (value) => {
  if (value !== content.value) {
    content.value = value
  }
  sectionContentLength.value = plainTextLengthFromHtml(value)
})

watch(content, (value) => {
  const nextLength = plainTextLengthFromHtml(value)
  sectionContentLength.value = nextLength
  if (nextLength > contentLimit) {
    trimSectionContentToLimit()
    return
  }
  if (value !== sectionContent.value) {
    sectionContent.value = value
  }
})

const sectionContentMeta = computed(() =>
  formatValidationMessage(arrivalValidation.messages.counter, {
    current: Math.min(sectionContentLength.value, contentLimit),
    max: contentLimit,
  }),
)

function trimSectionContentToLimit() {
  if (!quill) return
  const currentLength = quill.getLength()
  if (currentLength <= contentLengthLimit) return
  quill.deleteText(contentLengthLimit - 1, currentLength - contentLengthLimit, 'silent')
  content.value = quill.root.innerHTML
  sectionContentLength.value = plainTextLengthFromHtml(content.value)
}

const options: QuillOptions = {
  theme: 'snow',
  placeholder: props.placeholder,
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
      [
        { list: 'bullet' },
      ],
    ],
  },
}

const toolbarLabels = computed(() => ({
  '--editor-ql-text': `'${toolbarContent.text}'`,
  '--editor-ql-title': `'${toolbarContent.title}'`,
}))

onMounted(() => {
  quill = editor.value?.initialize(Quill)
  applyQuillToolbarTitles(quill, {
    text: toolbarContent.text,
    title: toolbarContent.title,
  })
  trimSectionContentToLimit()
  sectionContentLength.value = plainTextLengthFromHtml(content.value)
})
</script>

<template>
  <section class="editor-arrival-html-panel">
    <div class="header">
      <h3>{{ props.title }}</h3>
      <p v-if="props.subtitle">{{ props.subtitle }}</p>
    </div>

    <div
      class="body"
      :style="toolbarLabels"
    >
      <p class="label">{{ props.label }}</p>
      <QuillyEditor
        ref="editor"
        v-model="content"
        :options="options"
      />
      <p class="meta">{{ sectionContentMeta }}</p>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/ArrivalPanels/arrival-html-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/animations' as animations;
@use '@/styles/components/inputs' as inputs;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-arrival-html-panel {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;

    > .label {
      margin: 0 0 0.5rem 0;
      @include little-text($color: rgba($secondary, 0.7), $bold: true, $thin: false);
      text-transform: uppercase;
      letter-spacing: 0.04rem;
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
    }

    > .meta {
      margin: 0;
      @include little-text($color: rgba($secondary, 0.65), $thin: false);
    }
  }
}
</style>
