<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/ImportPanel.vue -->

<script setup lang="ts">
import { ref } from 'vue'
import { editorStatic } from '@/views/Editor/utils/editorContent'

const airbnbUrl = ref('')
const bookingUrl = ref('')
const panelContent = editorStatic.panels.listing.import
</script>

<template>
  <section class="editor-import-panel in-dev-hide">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
      <div class="row">
        <div class="input action">
          <input
            v-model="airbnbUrl"
            :placeholder="panelContent.airbnbPlaceholder"
            type="text"
            disabled
          />
          <div class="action">
            <button
              type="button"
              disabled
            >
              {{ panelContent.cta }}
            </button>
          </div>
        </div>
      </div>

      <div class="row">
        <div class="input action">
          <input
            v-model="bookingUrl"
            :placeholder="panelContent.bookingPlaceholder"
            type="text"
            disabled
          />
          <div class="action">
            <button
              type="button"
              disabled
            >
              {{ panelContent.cta }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/import-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/components/inputs' as inputs;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-import-panel {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;

    > .row {
      > .input {
        @include inputs.action($theme: base, $action-theme: white);
      }
    }
  }
}
</style>
