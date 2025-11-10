<!-- File: src/views/ListingView/components/ListingCore/ListingCore.vue -->

<script setup lang="ts">
// DEPS

// UTILS
import { vp } from '@/utils/viewport'
import { listingCore } from '@/views/ListingView/utils/useParseContent'

// COMPONENTS
import Title from '@/views/ListingView/components/ListingCore/components/Title/Title.vue'
import DatePicker from '@/views/ListingView/components/ListingCore/components/DatePicker/DatePicker.vue'
import Perks from '@/views/ListingView/components/ListingCore/components/Perks/Perks.vue'
import HostProfile from '@/views/ListingView/components/ListingCore/components/HostProfile/HostProfile.vue'

//CONTENT
const data = await listingCore()
const title = data.title
const perks = data.perks
const host = data.hostProfile
</script>

<template>
  <section id="listing-core">
    <Title
      :title="title.title"
      :type="title.type"
      :location="title.location"
      :capacity="title.capacity"
      :bedrooms="title.bedrooms"
      :bathrooms="title.bathrooms"
    />
    <Perks :perks="perks" />
    <HostProfile :host="host" />
    <DatePicker />
  </section>
</template>

<style lang="scss">
@use '@/views/ListingView/components/ListingCore/listing-core.scss';
</style>
