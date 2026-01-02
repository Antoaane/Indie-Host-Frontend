<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/DescriptionPanel.vue -->

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { RawCore } from '@/views/Listing/utils/fetchListingRaw'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'

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

watch(description, (value) => {
  if (value !== content.value) {
    content.value = value
  }
})

watch(content, (value) => {
  if (value !== description.value) {
    description.value = value
  }
})

const options: QuillOptions = {
  theme: 'snow',
  placeholder: 'Start writing...',
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

onMounted(() => {
  quill = editor.value?.initialize(Quill)
  console.log('Description content:', description.value)
})
</script>

<template>
  <section class="editor-description-panel">
    <div class="header">
      <h3>Présentation</h3>
      <p>Donnez une description unique à votre logement</p>
    </div>

    <div class="body">
      <!-- <textarea
        v-model="description"
        class="textarea"
        rows="6"
        placeholder="Décrivez votre logement…"
      /> -->
      <QuillyEditor
        ref="editor"
        :options="options"
        v-model="content"
      />
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/description-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/animations' as animations;
@use '@/styles/components/inputs' as inputs;
@use '@/views/Editor/components/EditorSidebar/panels/ListingPanels/listing-panels.scss' as *;

.editor-description-panel {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;

    > .textarea {
      @include inputs.text($tertiary, borders.$rounded-md);
      width: 100%;
      resize: vertical;
      min-height: 9rem;
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
          content: 'Texte';
        }

        .ql-picker-item[data-value='2']::before {
          content: 'Titre';
        }

        .ql-picker-label::before {
          content: 'Texte';
        }

        .ql-picker-label[data-value='2']::before {
          content: 'Titre';
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
          background-color: rgba($secondary, 0.25);
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
      border: none;

      > .ql-editor {
        width: 100%;
        min-height: 9rem;

        @include inputs.text($tertiary, borders.$rounded-md);
      }
    }
  }
}
</style>
