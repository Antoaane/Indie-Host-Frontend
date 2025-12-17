<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/ReviewsPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { RawCore } from '@/views/Listing/utils/fetchListingRaw'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'

type ReviewsVisibility = {
  indiehost: boolean
  airbnb: boolean
  booking: boolean
}

const props = defineProps<{
  core?: Partial<RawCore> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const visibility = computed<ReviewsVisibility>(() => {
  const raw = (props.core as any)?.['reviews-display']
  if (raw && typeof raw === 'object') {
    return {
      indiehost: Boolean(raw.indiehost),
      airbnb: Boolean(raw.airbnb),
      booking: Boolean(raw.booking),
    }
  }
  return { indiehost: true, airbnb: true, booking: true }
})

function setVisibility(next: ReviewsVisibility) {
  emit('patch', { core: { ['reviews-display']: next } as any })
}
</script>

<template>
  <section class="editor-panel">
    <div class="editor-panel__header">
      <h3>Avis</h3>
      <p>Modifiez les avis que vous souhaitez afficher (cela n’impactera pas la note globale)</p>
    </div>

    <div class="editor-panel__body editor-reviews">
      <label class="editor-toggle">
        <input
          type="checkbox"
          :checked="visibility.indiehost"
          @change="setVisibility({ ...visibility, indiehost: ($event.target as HTMLInputElement).checked })"
        />
        <span>Avis Indie Host</span>
      </label>
      <label class="editor-toggle">
        <input
          type="checkbox"
          :checked="visibility.airbnb"
          @change="setVisibility({ ...visibility, airbnb: ($event.target as HTMLInputElement).checked })"
        />
        <span>Avis Airbnb</span>
      </label>
      <label class="editor-toggle">
        <input
          type="checkbox"
          :checked="visibility.booking"
          @change="setVisibility({ ...visibility, booking: ($event.target as HTMLInputElement).checked })"
        />
        <span>Avis Booking.com</span>
      </label>
    </div>
  </section>
</template>
