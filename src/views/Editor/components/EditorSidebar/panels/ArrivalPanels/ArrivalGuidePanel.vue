<!-- File: src/views/Editor/components/EditorSidebar/panels/ArrivalPanels/ArrivalGuidePanel.vue -->

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { RawArrival } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'

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

const guideTitle = computed({
  get: () => props.arrival?.guide?.title ?? '',
  set: (value: string) => {
    emit('patch', {
      arrival: {
        guide: {
          ...(props.arrival?.guide ?? {}),
          title: value,
        },
      },
    })
  },
})

const guideContent = computed({
  get: () => props.arrival?.guide?.content ?? '',
  set: (value: string) => {
    emit('patch', {
      arrival: {
        guide: {
          ...(props.arrival?.guide ?? {}),
          content: value,
        },
      },
    })
  },
})

const editor = ref<InstanceType<typeof QuillyEditor>>()
const content = ref(guideContent.value)
let quill: Quill | undefined

watch(guideContent, (value) => {
  if (value !== content.value) {
    content.value = value
  }
})

watch(content, (value) => {
  if (value !== guideContent.value) {
    guideContent.value = value
  }
})

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
  console.log('Arrival guide content:', guideContent.value)
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
            @input="guideTitle = ($event.target as HTMLInputElement).value"
          />
        </div>
      </div>

      <p class="label">{{ panelContent.contentLabel }}</p>
      <QuillyEditor
        ref="editor"
        v-model="content"
        :options="options"
      />
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
  }
}
</style>
