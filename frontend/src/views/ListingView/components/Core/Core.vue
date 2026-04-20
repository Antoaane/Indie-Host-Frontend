<!-- File: src/views/ListingView/components/Core/Core.vue -->

<script setup lang="ts">
// DEPS
import { computed } from 'vue'

// UTILS
import staticLocale from '@/locales/_static/fr.json'
import type { RangeISO } from '@/components/DatePicker/helpers/date'
import type { ListingParsed } from '@/views/ListingView/types/listing'
import { useListingViewport } from '@/views/ListingView/composables/useListingViewport'

// COMPONENTS
import Title from '@/views/ListingView/components/Core/components/Title/Title.vue'
import Perks from '@/views/ListingView/components/Core/components/Perks/Perks.vue'
import HostProfile from '@/views/ListingView/components/Core/components/HostProfile/HostProfile.vue'
import Description from '@/views/ListingView/components/Core/components/Description/Description.vue'
import Amenities from '@/views/ListingView/components/Core/components/Amenities/Amenities.vue'
import Rooms from '@/views/ListingView/components/Core/components/Rooms/Rooms.vue'
import Availabilities from '@/views/ListingView/components/Core/components/Availabilities/Availabilities.vue'

import Map from '@/views/ListingView/components/Core/components/Map/Map.vue'

//CONTENT
const props = withDefaults(
  defineProps<{
    data: ListingParsed
    modelValue?: RangeISO | null
    previewOnly?: boolean
  }>(),
  {
    modelValue: null,
    previewOnly: false,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: RangeISO | null): void
}>()

const { isLg } = useListingViewport()

const selection = computed<RangeISO | null>({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

interface StaticContent {
  listing: {
    headings: {
      features: string
      availability: string
      map: string
    }
    description: {
      title: string
      ctaLabel?: string
    }
    title: {
      travelers: string
      beds: string
      bedrooms: string
      bathrooms: string
    }
    host: {
      seniority: string
    }
    ctas: {
      seeMore: string
    }
    rooms: {
      title: string
      bedType: {
        simple: string
        double: string
        bunk: string
      }
    }
    amenities: {
      title: string
      ctaLabel: string
      overlayTitle?: string
    }
  }
  amenityIcons: string[]
}

const staticContent = staticLocale as StaticContent

const hostProfileStatic = {
  seniority: staticContent.listing.host.seniority,
}

const descriptionStatic = {
  title: staticContent.listing.description.title,
  ctaLabel: staticContent.listing.description.ctaLabel || staticContent.listing.ctas.seeMore,
}
</script>

<template>
  <section
    id="core"
    class="core"
  >
    <Title
      :data="props.data.title"
      :staticContent="staticContent.listing.title"
    />
    <Perks
      v-if="props.data.perks.length > 0"
      :data="props.data.perks"
    />
    <Description
      :data="props.data.description"
      :staticContent="descriptionStatic"
    />
    <HostProfile
      v-if="!props.previewOnly && props.data.hostProfile.name"
      :data="props.data.hostProfile"
      :staticContent="staticContent.listing.host"
    />
    <Amenities
      :data="props.data.amenities"
      :staticContent="staticContent.listing.amenities"
      :previewCount="isLg ? 8 : 6"
    />
    <Rooms
      :data="props.data.rooms"
      :staticContent="staticContent.listing.rooms"
    />
    <Availabilities
      v-if="isLg"
      v-model:model-value="selection"
      :data="props.data.bookings"
      :static-content="staticContent.listing.headings"
    />
    <Map
      :latitude="props.data.map.latitude"
      :longitude="props.data.map.longitude"
      :zoom="props.data.map.zoom"
      :query="props.data.map.query"
      :static-content="staticContent.listing.headings"
    />
  </section>
</template>

<style lang="scss">
/* File: src/views/ListingView/components/Core/core.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.core#core {
  height: 100%;

  display: flex;
  flex-direction: column;
  gap: calc(var(--layout-gap-2xl) * 2);

  background-color: $accent;
  border-radius: borders.$rounded-lg;

  padding: var(--layout-gap);

  .listing-view:not(.is-mobile-layout) & {
    overflow: hidden;
    overflow-y: scroll;
    border-radius: borders.$rounded-lg;
    gap: var(--layout-gap-2xl);
  }
}
</style>
