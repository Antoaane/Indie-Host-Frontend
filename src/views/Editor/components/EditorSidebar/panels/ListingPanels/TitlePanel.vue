<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/TitlePanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { RawCore } from '@/views/Listing/utils/fetchListingRaw'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'

const props = defineProps<{
  core?: Partial<RawCore> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const title = computed({
  get: () => props.core?.title ?? '',
  set: (value: string) => {
    emit('patch', { core: { title: value } })
  },
})

const panelContent = editorStatic.panels.listing.title
</script>

<template>
  <section class="editor-title-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
      <div class="input">
        <input
          v-model="title"
          type="text"
          :placeholder="panelContent.placeholder"
        />
      </div>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/title-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/components/inputs' as inputs;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-title-panel {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;

    > .input {
      @include inputs.field($theme: base);
    }
  }
}
</style>
