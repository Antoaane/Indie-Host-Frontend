<!-- File: src/views/Editor/components/EditorSidebar/panels/ArrivalPanels/ArrivalGuidePanel.vue -->

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { RawArrival } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import {
  formatValidationMessage,
  normalizeTextInput,
  plainTextLengthFromHtml,
  resolveTextMaxLength,
  shouldDisplayTextLimit,
} from '@/utils/inputValidation'

import { QuillyEditor } from 'vue-quilly'
import type { QuillOptions } from 'quill/core'
import Quill from 'quill'
import 'quill/dist/quill.bubble.css'
import 'quill/dist/quill.snow.css'

const props = defineProps<{
  arrival?: Partial<RawArrival> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const panelContent = editorStatic.panels.arrival.guide
const toolbarContent = editorStatic.panels.listing.description.toolbar
const arrivalLimits = editorStatic.validation.arrival
const textDefaults = editorStatic.validation.defaults.simpleText
const guideTitleMaxLength = resolveTextMaxLength(arrivalLimits.guideTitleMax, textDefaults)
const showGuideTitleCounter = shouldDisplayTextLimit(guideTitleMaxLength, textDefaults)
const guideContentLengthLimit = arrivalLimits.guideContentMaxPlainText + 1

const guideTitle = computed({
  get: () => props.arrival?.guide?.title ?? '',
  set: (value: string) => {
    const next = normalizeTextInput(value, guideTitleMaxLength)
    emit('patch', {
      arrival: {
        guide: {
          title: next,
          content: props.arrival?.guide?.content ?? '',
        },
      } as Partial<RawArrival>,
    })
  },
})

const guideContent = computed({
  get: () => props.arrival?.guide?.content ?? '',
  set: (value: string) => {
    emit('patch', {
      arrival: {
        guide: {
          title: props.arrival?.guide?.title ?? '',
          content: value,
        },
      } as Partial<RawArrival>,
    })
  },
})

const editor = ref<InstanceType<typeof QuillyEditor>>()
const content = ref(guideContent.value)
let quill: Quill | undefined
const guideContentLength = ref(plainTextLengthFromHtml(content.value))

watch(guideContent, (value) => {
  if (value !== content.value) {
    content.value = value
  }
  guideContentLength.value = plainTextLengthFromHtml(value)
})

watch(content, (value) => {
  const nextLength = plainTextLengthFromHtml(value)
  guideContentLength.value = nextLength
  if (nextLength > arrivalLimits.guideContentMaxPlainText) {
    trimGuideContentToLimit()
    return
  }
  if (value !== guideContent.value) {
    guideContent.value = value
  }
})

const guideTitleLength = computed(() => Math.min(guideTitle.value.length, guideTitleMaxLength))
const guideTitleMeta = computed(() =>
  formatValidationMessage(arrivalLimits.messages.counter, {
    current: guideTitleLength.value,
    max: guideTitleMaxLength,
  }),
)
const guideContentMeta = computed(
  () =>
    formatValidationMessage(arrivalLimits.messages.counter, {
      current: Math.min(guideContentLength.value, arrivalLimits.guideContentMaxPlainText),
      max: arrivalLimits.guideContentMaxPlainText,
    }),
)

function trimGuideContentToLimit() {
  if (!quill) return
  const currentLength = quill.getLength()
  if (currentLength <= guideContentLengthLimit) return
  quill.deleteText(guideContentLengthLimit - 1, currentLength - guideContentLengthLimit, 'silent')
  content.value = quill.root.innerHTML
  guideContentLength.value = plainTextLengthFromHtml(content.value)
}

const options: QuillOptions = {
  theme: 'snow',
  placeholder: panelContent.contentPlaceholder,
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
  trimGuideContentToLimit()
  guideContentLength.value = plainTextLengthFromHtml(content.value)
})
</script>

<template>
  <section class="editor-arrival-guide-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div
      class="body"
      :style="toolbarLabels"
    >
      <div class="input">
        <label>{{ panelContent.titleLabel }}</label>
        <div class="field">
          <input
            type="text"
            :value="guideTitle"
            :placeholder="panelContent.titlePlaceholder"
            :maxlength="guideTitleMaxLength"
            autocomplete="off"
            inputmode="text"
            @input="guideTitle = ($event.target as HTMLInputElement).value"
          />
        </div>
        <p
          v-if="showGuideTitleCounter"
          class="meta"
        >
          {{ guideTitleMeta }}
        </p>
      </div>

      <p class="label">{{ panelContent.contentLabel }}</p>
      <QuillyEditor
        ref="editor"
        v-model="content"
        :options="options"
      />
      <p class="meta">{{ guideContentMeta }}</p>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/ArrivalPanels/arrival-guide-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/animations' as animations;
@use '@/styles/components/inputs' as inputs;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-arrival-guide-panel {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;

    > .input {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;

      > label {
        display: block;
        @include little-text($color: rgba($secondary, 0.7), $bold: true, $thin: false);
        text-transform: uppercase;
        letter-spacing: 0.04rem;
      }

      > .field {
        @include inputs.field($theme: base);
      }

      > .meta {
        margin: 0;
        @include little-text($color: rgba($secondary, 0.62), $thin: false);
      }
    }

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
