<!-- File: src/views/Editor/components/EditorPanels/panels/DescriptionPanel.vue -->

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

const description = computed({
  get: () => props.core?.description ?? '',
  set: (value: string) => emit('patch', { core: { description: value } }),
})
</script>

<template>
  <section class="editor-panel">
    <header class="editor-panel__header">
      <h3>Présentation</h3>
      <p>Donnez une description unique à votre logement</p>
    </header>

    <div class="editor-panel__body">
      <textarea
        v-model="description"
        class="editor-textarea"
        rows="6"
        placeholder="Décrivez votre logement…"
      />
    </div>
  </section>
</template>

