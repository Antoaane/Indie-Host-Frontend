<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/ReviewsPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { RawCore } from '@/views/Listing/utils/fetchListingRaw'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'

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

const panelContent = editorStatic.panels.listing.reviews
</script>

<template>
  <section class="editor-reviews-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
      <label class="toggle">
        <input
          type="checkbox"
          :checked="visibility.indiehost"
          @change="setVisibility({ ...visibility, indiehost: ($event.target as HTMLInputElement).checked })"
        />
        <span>{{ panelContent.toggle.indiehost }}</span>
      </label>
      <label class="toggle">
        <input
          type="checkbox"
          :checked="visibility.airbnb"
          @change="setVisibility({ ...visibility, airbnb: ($event.target as HTMLInputElement).checked })"
        />
        <span>{{ panelContent.toggle.airbnb }}</span>
      </label>
      <label class="toggle">
        <input
          type="checkbox"
          :checked="visibility.booking"
          @change="setVisibility({ ...visibility, booking: ($event.target as HTMLInputElement).checked })"
        />
        <span>{{ panelContent.toggle.booking }}</span>
      </label>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/reviews-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/components/buttons' as buttons;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-reviews-panel {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;

    > .toggle {
      @include buttons.checkbox-label(white);
      border: 1px solid rgba($secondary, 0.06);
    }
  }
}
</style>
