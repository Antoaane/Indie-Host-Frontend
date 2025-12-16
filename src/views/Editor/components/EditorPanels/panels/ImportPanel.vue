<!-- File: src/views/Editor/components/EditorPanels/panels/ImportPanel.vue -->

<script setup lang="ts">
import { ref } from 'vue'

const airbnbUrl = ref('')
const bookingUrl = ref('')
</script>

<template>
  <section class="editor-panel">
    <header class="editor-panel__header">
      <h3>Importez votre annonce</h3>
      <p>Vous pouvez récupérer les informations d’un logement existant sur l’une de ces plateformes</p>
    </header>

    <div class="editor-panel__body editor-import">
      <input
        v-model="airbnbUrl"
        class="editor-input"
        placeholder="https://www.airbnb.fr/rooms/…"
        type="text"
        disabled
      />
      <button
        class="btn-primary__white__full"
        type="button"
        disabled
      >
        Importer
      </button>

      <input
        v-model="bookingUrl"
        class="editor-input"
        placeholder="https://www.booking.com/hotel/…"
        type="text"
        disabled
      />
      <button
        class="btn-primary__white__full"
        type="button"
        disabled
      >
        Importer
      </button>
    </div>
  </section>
</template>
