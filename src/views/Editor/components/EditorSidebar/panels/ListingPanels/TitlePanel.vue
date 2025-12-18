<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/TitlePanel.vue -->

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
  <section class="editor-title-panel">
    <div class="header">
      <h3>Titre de l’annonce</h3>
      <p>Donnez un nom original à votre lieu</p>
    </div>

    <div class="body">
      <input
        v-model="title"
        class="input"
        type="text"
        placeholder="Maison flottante / Houseboat - …"
      />
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/title-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/components/inputs' as inputs;

.editor-title-panel {
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

    > .input {
      @include inputs.text($tertiary, borders.$rounded-md);
      width: 100%;
    }
  }
}

</style>
