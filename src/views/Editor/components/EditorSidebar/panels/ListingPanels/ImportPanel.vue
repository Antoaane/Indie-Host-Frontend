<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/ImportPanel.vue -->

<script setup lang="ts">
import { ref } from 'vue'

const airbnbUrl = ref('')
const bookingUrl = ref('')
</script>

<template>
  <section class="editor-panel">
    <div class="editor-panel__header">
      <h3>Importez votre annonce</h3>
      <p>Vous pouvez récupérer les informations d’un logement existant sur l’une de ces plateformes</p>
    </div>

    <div class="editor-panel__body editor-import">
      <div class="editor-import__row">
        <input
          v-model="airbnbUrl"
          class="editor-input"
          placeholder="https://www.airbnb.fr/rooms/…"
          type="text"
          disabled
        />
        <div class="btn-primary__white">
          <button
            type="button"
            disabled
          >
            Importer
          </button>
        </div>
      </div>

      <div class="editor-import__row">
        <input
          v-model="bookingUrl"
          class="editor-input"
          placeholder="https://www.booking.com/hotel/…"
          type="text"
          disabled
        />
        <div class="btn-primary__white">
          <button
            type="button"
            disabled
          >
            Importer
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
.editor-import {
  &__row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--gutter-spacing-xs);
    align-items: center;
  }
}
</style>
