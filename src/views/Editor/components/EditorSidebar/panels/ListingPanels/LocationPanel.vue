<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/LocationPanel.vue -->

<script setup lang="ts">
import type { RawCore } from '@/views/Listing/utils/fetchListingRaw'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'

const props = defineProps<{
  core?: Partial<RawCore> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

function patchCore(patch: Partial<RawCore>) {
  emit('patch', { core: patch })
}

const panelContent = editorStatic.panels.listing.location
</script>

<template>
  <section class="editor-location-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
      <div class="input">
        <input
          :value="props.core?.type ?? ''"
          type="text"
          :placeholder="panelContent.placeholders.type"
          @input="patchCore({ type: ($event.target as HTMLInputElement).value } as any)"
        />
      </div>
      <div class="row">
        <div class="input">
          <input
            :value="props.core?.city ?? ''"
            type="text"
            :placeholder="panelContent.placeholders.city"
            @input="patchCore({ city: ($event.target as HTMLInputElement).value } as any)"
          />
        </div>
        <div class="input">
          <input
            :value="props.core?.country ?? ''"
            type="text"
            :placeholder="panelContent.placeholders.country"
            @input="patchCore({ country: ($event.target as HTMLInputElement).value } as any)"
          />
        </div>
      </div>
      <div class="input">
        <input
          :value="props.core?.region ?? ''"
          type="text"
          :placeholder="panelContent.placeholders.region"
          @input="patchCore({ region: ($event.target as HTMLInputElement).value } as any)"
        />
      </div>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/location-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/components/inputs' as inputs;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-location-panel {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;

    > .input {
      @include inputs.field($theme: base);
    }

    > .row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--layout-gap-xs);

      > .input {
        @include inputs.field($theme: base);
      }
    }
  }
}
</style>
