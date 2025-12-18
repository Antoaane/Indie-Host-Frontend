<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/DescriptionPanel.vue -->

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
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/description-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/components/inputs' as inputs;

.editor-description-panel {
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

    > .textarea {
      @include inputs.text($tertiary, borders.$rounded-md);
      width: 100%;
      resize: vertical;
      min-height: 9rem;
    }
  }
}

</style>
