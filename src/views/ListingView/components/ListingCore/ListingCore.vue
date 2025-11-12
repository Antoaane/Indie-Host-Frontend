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
  }
  amenityIcons: string[]
}

interface CommonContent {
  plurals: {
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
}

const staticContent = staticLocale as StaticContent
const commonContent = commonLocale as CommonContent

const titlePlurals = {
  travelers: commonContent.plurals.travelers,
  bedrooms: commonContent.plurals.bedrooms,
  beds: commonContent.plurals.beds,
  bathrooms: commonContent.plurals.bathrooms,
}

const hostProfileCopy = {
  seniority: commonContent.host.seniority,
}

const descriptionCopy = {
  title: staticContent.listing.headings.description,
  ctaLabel: staticContent.listing.description.ctaLabel || commonContent.ctas.seeMore,
}
</script>

<template>
  <section id="listing-core">
    <Title
      :data="data.title"
      :plurals="titlePlurals"
    />
    <Perks :data="data.perks" />
    <HostProfile
      :data="data.hostProfile"
      :labels="hostProfileCopy"
    />
    <Description
      :data="data.description"
      :copy="descriptionCopy"
    />
    <div>
      <Rooms :data="data.rooms" />
    </div>
    <DatePicker />
  </section>
</template>

<style lang="scss">
@use '@/views/ListingView/components/ListingCore/listing-core.scss';
</style>
