<!-- File: src/views/Editor/components/EditorPanels/panels/TitlePanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { RawCore } from '@/views/Listing/utils/fetchListingRaw'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'

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
</script>

<template>
  <section class="editor-panel">
    <header class="editor-panel__header">
      <h3>Titre de l’annonce</h3>
      <p>Donnez un nom original à votre lieu</p>
    </header>

    <div class="editor-panel__body">
      <input
        v-model="title"
        class="editor-input"
        type="text"
        placeholder="Maison flottante / Houseboat - …"
      />
    </div>
  </section>
</template>

