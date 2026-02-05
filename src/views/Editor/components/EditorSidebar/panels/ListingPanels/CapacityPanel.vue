<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/CapacityPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { RawCore } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'

const props = defineProps<{
  core?: Partial<RawCore> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const capacity = computed(() => Number(props.core?.guest_capacity ?? 0))
const panelContent = editorStatic.panels.listing.capacity

function setCapacity(next: number) {
  emit('patch', { core: { guest_capacity: Math.max(0, next) } })
}
</script>

<template>
  <section class="editor-capacity-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
      <div class="stepper">
        <div class="btn">
          <button
            type="button"
            @click="setCapacity(capacity - 1)"
          >
            −
          </button>
        </div>
        <input
          class="value"
          type="number"
          min="0"
          :value="capacity"
          @input="setCapacity(Number(($event.target as HTMLInputElement).value))"
        />
        <div class="btn">
          <button
            type="button"
            @click="setCapacity(capacity + 1)"
          >
            +
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/capacity-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/components/inputs' as inputs;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-capacity-panel {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;

    > .stepper {
      @include inputs.stepper($theme: base);
    }
  }
}
</style>
