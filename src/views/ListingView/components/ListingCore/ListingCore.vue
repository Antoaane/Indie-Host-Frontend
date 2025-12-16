<!-- File: src/views/ListingView/components/ListingCore/ListingCore.vue -->

<script setup lang="ts">
// DEPS
import { computed } from 'vue'

// UTILS
import { vp } from '@/utils/viewport'
import staticLocale from '@/locales/_static/fr.json'
import type { RangeISO } from '@/components/DatePicker/helpers/date'
import type { ListingParsed } from '@/views/ListingView/types/listing'

// COMPONENTS
import Title from '@/views/ListingView/components/ListingCore/components/Title/Title.vue'
import Perks from '@/views/ListingView/components/ListingCore/components/Perks/Perks.vue'
import HostProfile from '@/views/ListingView/components/ListingCore/components/HostProfile/HostProfile.vue'
import Description from '@/views/ListingView/components/ListingCore/components/Description/Description.vue'
import Amenities from '@/views/ListingView/components/ListingCore/components/Amenities/Amenities.vue'
import Rooms from '@/views/ListingView/components/ListingCore/components/Rooms/Rooms.vue'
import Availabilities from '@/views/ListingView/components/ListingCore/components/Availabilities/Availabilities.vue'

import Map from '@/views/ListingView/components/ListingCore/components/Map/Map.vue'

//CONTENT
const props = withDefaults(
  defineProps<{
    data: ListingParsed
    modelValue?: RangeISO | null
  }>(),
  {
    modelValue: null,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: RangeISO | null): void
}>()

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
  <section id="listing-core">
    <Title
      :data="props.data.title"
      :staticContent="staticContent.listing.title"
    />
    <Perks :data="props.data.perks" />
    <Description
      :data="props.data.description"
      :staticContent="descriptionStatic"
    />
    <HostProfile
      :data="props.data.hostProfile"
      :staticContent="staticContent.listing.host"
    />
    <Amenities
      :data="props.data.amenities"
      :staticContent="staticContent.listing.amenities"
      :previewCount="vp.lg.value ? 8 : 6"
    />
    <Rooms
      :data="props.data.rooms"
      :staticContent="staticContent.listing.rooms"
    />
    <Availabilities
      v-if="vp.lg.value"
      v-model:model-value="selection"
      :data="props.data.bookings"
      :static-content="staticContent.listing.headings"
    />
    <Map
      :latitude="props.data.map.latitude"
      :longitude="props.data.map.longitude"
      :zoom="props.data.map.zoom"
      :static-content="staticContent.listing.headings"
    />
  </section>
</template>

<style lang="scss">
@use '@/views/ListingView/components/ListingCore/listing-core.scss';
</style>
