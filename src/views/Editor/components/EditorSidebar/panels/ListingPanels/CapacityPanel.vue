<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/CapacityPanel.vue -->

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

const capacity = computed(() => Number(props.core?.guest_capacity ?? 0))

function setCapacity(next: number) {
  emit('patch', { core: { guest_capacity: Math.max(0, next) } })
}
</script>

<template>
  <section class="editor-capacity-panel">
    <div class="header">
      <h3>Capacité d’accueil</h3>
      <p>Combien de voyageurs pouvez vous accueillir</p>
    </div>

    <div class="body">
      <div class="stepper">
        <div
          class="btn"
        >
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
        <div
          class="btn"
        >
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
@use '@/styles/components/buttons' as buttons;
@use '@/styles/components/inputs' as inputs;

.editor-capacity-panel {
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

    > .stepper {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-xs);

      > .btn {
        @include buttons.primary($theme: black, $padding: false);
        width: 36px;
        height: 36px;

        > * {
          height: 100%;
          padding: 0;
          font-size: 1.1rem;
          font-weight: 700;
        }
      }

      > .value {
        width: 56px;
        text-align: center;
        @include inputs.text($tertiary, borders.$rounded-md);
      }
    }
  }
}

</style>
