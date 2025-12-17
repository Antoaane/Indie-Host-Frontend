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
  <section class="editor-panel">
    <div class="editor-panel__header">
      <h3>Capacité d’accueil</h3>
      <p>Combien de voyageurs pouvez vous accueillir</p>
    </div>

    <div class="editor-panel__body">
      <div class="editor-stepper">
        <div
          class="editor-stepper__btn"
        >
          <button
            type="button"
            @click="setCapacity(capacity - 1)"
          >
            −
          </button>
        </div>
        <input
          class="editor-stepper__value"
          type="number"
          min="0"
          :value="capacity"
          @input="setCapacity(Number(($event.target as HTMLInputElement).value))"
        />
        <div
          class="editor-stepper__btn"
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
