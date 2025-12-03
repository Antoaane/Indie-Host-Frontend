<!-- File: src/views/ListingView/components/ListingCore/ListingCore.vue -->

<script setup lang="ts">
// DEPS
import { computed } from 'vue'

// UTILS
import { vp } from '@/utils/viewport'
import { listingCore } from '@/views/ListingView/utils/useParseContent'
import staticLocale from '@/locales/_static/fr.json'
import commonLocale from '@/locales/common/fr.json'
import type { RangeISO } from '@/components/DatePicker/helpers/date'

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

const data = await listingCore()

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
      :data="data.title"
      :staticContent="staticContent.listing.title"
    />
    <Perks :data="data.perks" />
    <Description
      :data="data.description"
      :staticContent="descriptionStatic"
    />
    <HostProfile
      :data="data.hostProfile"
      :staticContent="staticContent.listing.host"
    />
    <Amenities
      :data="data.amenities"
      :static-content="staticContent.listing.amenities"
    />
    <Rooms
      :data="data.rooms"
      :staticContent="staticContent.listing.rooms"
    />
    <Availabilities
      v-model:model-value="selection"
      :data="data.bookings"
      :static-content="staticContent.listing.headings"
    />
    <Map
      :latitude="data.map.latitude"
      :longitude="data.map.longitude"
      :zoom="data.map.zoom"
      :static-content="staticContent.listing.headings"
    />
  </section>
</template>

<style lang="scss">
@use '@/views/ListingView/components/ListingCore/listing-core.scss';
</style>
