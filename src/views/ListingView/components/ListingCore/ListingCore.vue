<!-- File: src/views/ListingView/components/ListingCore/ListingCore.vue -->

<script setup lang="ts">
// DEPS

// UTILS
import { vp } from '@/utils/viewport'
import { listingCore } from '@/views/ListingView/utils/useParseContent'
import staticLocale from '@/locales/_static/fr.json'
import commonLocale from '@/locales/common/fr.json'

// COMPONENTS
import Title from '@/views/ListingView/components/ListingCore/components/Title/Title.vue'
import DatePicker from '@/views/ListingView/components/ListingCore/components/DatePicker/DatePicker.vue'
import Perks from '@/views/ListingView/components/ListingCore/components/Perks/Perks.vue'
import HostProfile from '@/views/ListingView/components/ListingCore/components/HostProfile/HostProfile.vue'
import Description from '@/views/ListingView/components/ListingCore/components/Description/Description.vue'
import Rooms from '@/views/ListingView/components/ListingCore/components/Rooms/Rooms.vue'

//CONTENT
const data = await listingCore()

interface StaticContent {
  listing: {
    headings: {
      features: string
      availability: string
      description: string
    }
    description: {
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
  }
  amenityIcons: string[]
}

const staticContent = staticLocale as StaticContent

const hostProfileStatic = {
  seniority: staticContent.listing.host.seniority,
}

const descriptionStatic = {
  title: staticContent.listing.headings.description,
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
    <HostProfile
      :data="data.hostProfile"
      :staticContent="staticContent.listing.host"
    />
    <Description
      :data="data.description"
      :staticContent="descriptionStatic"
    />
    <div>
      <Rooms
        :data="data.rooms"
        :staticContent="staticContent.listing.rooms"
      />
    </div>
    <DatePicker />
  </section>
</template>

<style lang="scss">
@use '@/views/ListingView/components/ListingCore/listing-core.scss';
</style>
