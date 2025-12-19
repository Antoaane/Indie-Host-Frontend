<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/DescriptionPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { RawCore } from '@/views/Listing/utils/fetchListingRaw'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'

import { ref, onMounted } from 'vue'
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
const content = ref('')
let quill: Quill | undefined

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
})
</script>

<template>
  <section class="editor-description-panel">
    <div class="header">
      <h3>Présentation</h3>
      <p>Donnez une description unique à votre logement</p>
    </div>

    <div class="body">
      <textarea
        v-model="description"
        class="textarea"
        rows="6"
        placeholder="Décrivez votre logement…"
      />
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
  }
}
</style>
