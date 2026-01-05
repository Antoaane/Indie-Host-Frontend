<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/ImportPanel.vue -->

<script setup lang="ts">
import { ref } from 'vue'

const airbnbUrl = ref('')
const bookingUrl = ref('')
</script>

<template>
  <section class="editor-import-panel">
    <div class="header">
      <h3>Importez votre annonce</h3>
      <p>Vous pouvez récupérer les informations d’un logement existant sur l’une de ces plateformes</p>
    </div>

    <div class="body">
      <div class="row">
        <div class="input action">
          <input
            v-model="airbnbUrl"
            placeholder="https://www.airbnb.fr/rooms/…"
            type="text"
            disabled
          />
          <div class="action">
            <button
              type="button"
              disabled
            >
              Importer
            </button>
          </div>
        </div>
      </div>

      <div class="row">
        <div class="input action">
          <input
            v-model="bookingUrl"
            placeholder="https://www.booking.com/hotel/…"
            type="text"
            disabled
          />
          <div class="action">
            <button
              type="button"
              disabled
            >
              Importer
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
@use '@/views/Editor/components/EditorSidebar/panels/ListingPanels/listing-panels.scss' as *;

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
