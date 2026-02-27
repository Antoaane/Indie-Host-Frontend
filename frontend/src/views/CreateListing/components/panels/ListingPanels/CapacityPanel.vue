<!-- File: src/views/CreateListing/components/panels/ListingPanels/CapacityPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { RawCore } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import { clampInteger, formatValidationMessage } from '@/utils/inputValidation'

const props = defineProps<{
  core?: Partial<RawCore> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const capacityValidation = editorStatic.validation.listing.capacity
const capacity = computed(() =>
  clampInteger(
    props.core?.guest_capacity,
    capacityValidation.min,
    capacityValidation.max,
    capacityValidation.min,
  ),
)
const capacityHint = computed(() =>
  formatValidationMessage(capacityValidation.messages.hint, {
    min: capacityValidation.min,
    max: capacityValidation.max,
  }),
)
const panelContent = editorStatic.panels.listing.capacity

function setCapacity(next: number) {
  const normalized = clampInteger(next, capacityValidation.min, capacityValidation.max, capacityValidation.min)
  if (normalized === capacity.value) return
  emit('patch', { core: { guest_capacity: normalized } })
}
</script>

<template>
  <section class="create-capacity-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
      <div class="stepper">
        <div class="btn">
          <button
            type="button"
            :disabled="capacity <= capacityValidation.min"
            @click="setCapacity(capacity - 1)"
          >
            −
          </button>
        </div>
        <input
          class="value"
          type="number"
          :min="capacityValidation.min"
          :max="capacityValidation.max"
          step="1"
          inputmode="numeric"
          :value="capacity"
          @input="setCapacity(($event.target as HTMLInputElement).valueAsNumber)"
        />
        <div class="btn">
          <button
            type="button"
            :disabled="capacity >= capacityValidation.max"
            @click="setCapacity(capacity + 1)"
          >
            +
          </button>
        </div>
      </div>
      <p class="hint">{{ capacityHint }}</p>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/CreateListing/components/panels/ListingPanels/capacity-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/components/inputs' as inputs;
@use '@/views/CreateListing/components/panels/panel.scss' as *;

.create-capacity-panel {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;

    > .stepper {
      @include inputs.stepper($theme: base);
    }

    > .hint {
      margin: 0;
      @include little-text($thin: false);
      color: rgba($secondary, 0.7);
    }
  }
}
</style>
