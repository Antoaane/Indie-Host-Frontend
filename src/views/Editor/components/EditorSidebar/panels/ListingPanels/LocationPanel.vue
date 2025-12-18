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
  <section class="editor-panel">
    <div class="editor-panel__header">
      <h3>Adresse</h3>
      <p>Seule une localisation approximative sera affichée sur l’annonce</p>
    </div>

    <div class="editor-panel__body editor-location">
      <input
        class="editor-input"
        :value="props.core?.type ?? ''"
        type="text"
        placeholder="Type (ex: Péniche)"
        @input="patchCore({ type: ($event.target as HTMLInputElement).value } as any)"
      />
      <div class="editor-location__row">
        <input
          class="editor-input"
          :value="props.core?.city ?? ''"
          type="text"
          placeholder="Ville"
          @input="patchCore({ city: ($event.target as HTMLInputElement).value } as any)"
        />
        <input
          class="editor-input"
          :value="props.core?.country ?? ''"
          type="text"
          placeholder="Pays"
          @input="patchCore({ country: ($event.target as HTMLInputElement).value } as any)"
        />
      </div>
      <input
        class="editor-input"
        :value="props.core?.region ?? ''"
        type="text"
        placeholder="Région"
        @input="patchCore({ region: ($event.target as HTMLInputElement).value } as any)"
      />
    </div>
  </section>
</template>

<style lang="scss">
.editor-location {
  &__row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--gutter-spacing-xs);
  }
}
</style>
