<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/LocationPanel.vue -->

<script setup lang="ts">
import type { RawCore } from '@/views/Listing/utils/fetchListingRaw'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'

const props = defineProps<{
  core?: Partial<RawCore> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

function patchCore(patch: Partial<RawCore>) {
  emit('patch', { core: patch })
}
</script>

<template>
  <section class="editor-location-panel">
    <div class="header">
      <h3>Adresse</h3>
      <p>Seule une localisation approximative sera affichée sur l’annonce</p>
    </div>

    <div class="body">
      <input
        class="input"
        :value="props.core?.type ?? ''"
        type="text"
        placeholder="Type (ex: Péniche)"
        @input="patchCore({ type: ($event.target as HTMLInputElement).value } as any)"
      />
      <div class="row">
        <input
          class="input"
          :value="props.core?.city ?? ''"
          type="text"
          placeholder="Ville"
          @input="patchCore({ city: ($event.target as HTMLInputElement).value } as any)"
        />
        <input
          class="input"
          :value="props.core?.country ?? ''"
          type="text"
          placeholder="Pays"
          @input="patchCore({ country: ($event.target as HTMLInputElement).value } as any)"
        />
      </div>
      <input
        class="input"
        :value="props.core?.region ?? ''"
        type="text"
        placeholder="Région"
        @input="patchCore({ region: ($event.target as HTMLInputElement).value } as any)"
      />
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/location-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/components/inputs' as inputs;
@use '@/views/Editor/components/EditorSidebar/panels/ListingPanels/listing-panels.scss' as *;

.editor-location-panel {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;

    > .input {
      @include inputs.text($tertiary, borders.$rounded-md);
      width: 100%;
    }

    > .row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--layout-gap-xs);

      > .input {
        @include inputs.text($tertiary, borders.$rounded-md);
        width: 100%;
      }
    }
  }
}
</style>
