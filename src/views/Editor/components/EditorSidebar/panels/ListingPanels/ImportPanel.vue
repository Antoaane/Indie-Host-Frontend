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
        <input
          v-model="airbnbUrl"
          class="input"
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

      <div class="row">
        <input
          v-model="bookingUrl"
          class="input"
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
/* File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/import-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/components/inputs' as inputs;

.editor-import-panel {
  padding: var(--spacing-sm);
  border-radius: borders.$rounded-md;
  background: $accent;
  border: 1px solid rgba($secondary, 0.06);

  > .header {
    margin-bottom: var(--spacing-sm);

    > h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
      color: $secondary;
    }

    > p {
      margin: 0.25rem 0 0 0;
      font-size: 0.875rem;
      font-weight: 300;
      color: rgba($secondary, 0.75);
    }
  }

  > .body {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);

    > .row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--spacing-xs);
      align-items: center;

      > .input {
        @include inputs.text($tertiary, borders.$rounded-md);
        width: 100%;
      }
    }
  }
}
</style>
