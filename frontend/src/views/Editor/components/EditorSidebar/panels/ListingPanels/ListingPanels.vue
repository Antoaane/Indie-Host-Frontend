<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/ListingPanels.vue -->

<script setup lang="ts">
import type { RawListingBundle } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'

import TitlePanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/TitlePanel.vue'
import DomainPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/DomainPanel.vue'
import CalendarPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/CalendarPanel.vue'
import VisibilityPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/VisibilityPanel.vue'
import GalleryPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/GalleryPanel.vue'
import DescriptionPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/DescriptionPanel.vue'
import AmenitiesPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/AmenitiesPanel.vue'
import CapacityPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/CapacityPanel.vue'
import LocationPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/LocationPanel.vue'
import RoomsPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/RoomsPanel.vue'
import ReviewsPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/ReviewsPanel.vue'

const props = defineProps<{
  listingId: string
  draft: RawListingBundle
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()
</script>

<template>
  <div class="editor-listing-panels">
    <TitlePanel
      :core="props.draft.core"
      @patch="emit('patch', $event)"
    />
    <DomainPanel :listing-id="props.listingId" />
    <GalleryPanel
    :medias="props.draft.medias"
    :listing-id="props.listingId"
    :listing-status="props.draft.core?.status"
    @patch="emit('patch', $event)"
    />
    <DescriptionPanel
    :core="props.draft.core"
    @patch="emit('patch', $event)"
    />
    <AmenitiesPanel
    :core="props.draft.core"
    @patch="emit('patch', $event)"
    />
    <CapacityPanel
    :core="props.draft.core"
    @patch="emit('patch', $event)"
    />
    <LocationPanel
    :core="props.draft.core"
    :require-precise-address="true"
    @patch="emit('patch', $event)"
    />
    <RoomsPanel
    :core="props.draft.core"
    @patch="emit('patch', $event)"
    />
    <ReviewsPanel
    :core="props.draft.core"
    @patch="emit('patch', $event)"
    />
    <CalendarPanel :listing-id="props.listingId" />
    <VisibilityPanel
      :core="props.draft.core"
      @patch="emit('patch', $event)"
    />
  </div>
</template>

<style lang="scss">
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-listing-panels {
  @extend %panels-stack;

  padding-bottom: var(--layout-gap);
}
</style>
