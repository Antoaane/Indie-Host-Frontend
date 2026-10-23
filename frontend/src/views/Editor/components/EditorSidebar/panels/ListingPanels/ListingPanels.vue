<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/ListingPanels.vue -->

<script setup lang="ts">
import { computed } from 'vue'

import type { RawListingBundle } from '@/domain/listings/types'
import type { ListingDomainRecord } from '@/domain/api/listingDomains'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'

import ImportPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/ImportPanel/ImportPanel.vue'
import TitlePanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/TitlePanel.vue'
import DomainPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/DomainPanel.vue'
import CustomDomainPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/CustomDomainPanel.vue'
import ParentListingPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/ParentListingPanel.vue'
import HubChildrenPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/HubChildrenPanel.vue'
import CalendarPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/CalendarPanel.vue'
import VisibilityPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/VisibilityPanel.vue'
import GalleryPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/GalleryPanel.vue'
import DescriptionPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/DescriptionPanel.vue'
import AmenitiesPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/AmenitiesPanel.vue'
import CapacityPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/CapacityPanel.vue'
import LocationPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/LocationPanel.vue'
import RoomsPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/RoomsPanel.vue'
import LegalInfoPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/LegalInfoPanel.vue'
import ReviewsPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/ReviewsPanel.vue'

const props = defineProps<{
  listingId: string
  draft: RawListingBundle
  canPublishListing?: boolean
  isAdmin?: boolean
  ownerId?: string | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
  (e: 'domain-updated', domain: ListingDomainRecord): void
  (e: 'select-listing', listingId: string): void
}>()

// Une page principale (annonce mère) n'a ni tarifs, ni chambres, ni calendrier : seulement
// son identité, ses photos, son domaine et la liste des logements qu'elle présente.
const isHub = computed(() => props.draft.core?.kind === 'hub')
</script>

<template>
  <div class="editor-listing-panels">
    <TitlePanel
      :core="props.draft.core"
      @patch="emit('patch', $event)"
    />
    <DomainPanel
      :listing-id="props.listingId"
      :isAdmin="props.isAdmin"
      @updated="emit('domain-updated', $event)"
    />
    <CustomDomainPanel
      :listing-id="props.listingId"
      :isAdmin="props.isAdmin"
      @updated="emit('domain-updated', $event)"
    />
    <HubChildrenPanel
      v-if="isHub"
      :listing-id="props.listingId"
      @select="emit('select-listing', $event)"
    />
    <ParentListingPanel
      v-else
      :listing-id="props.listingId"
      :owner-id="props.ownerId"
    />
    <GalleryPanel
      :medias="props.draft.medias"
      :listing-id="props.listingId"
      :listing-status="props.draft.core?.status"
      :listing-title="props.draft.core?.title"
      @patch="emit('patch', $event)"
    />
    <DescriptionPanel
      :core="props.draft.core"
      @patch="emit('patch', $event)"
    />
    <template v-if="!isHub">
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
      <LegalInfoPanel
        :listing-id="props.listingId"
        :core="props.draft.core"
        :host="props.draft.host"
        @patch="emit('patch', $event)"
      />
      <ReviewsPanel
        :core="props.draft.core"
        @patch="emit('patch', $event)"
      />
      <CalendarPanel :listing-id="props.listingId" />
      <ImportPanel
        :listing-id="props.listingId"
        :listing-status="props.draft.core?.status"
        @patch="emit('patch', $event)"
      />
    </template>
    <VisibilityPanel
      :core="props.draft.core"
      :canPublishListing="props.canPublishListing"
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
