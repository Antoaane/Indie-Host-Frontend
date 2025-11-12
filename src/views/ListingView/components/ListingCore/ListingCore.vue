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
import Description from '@/views/ListingView/components/ListingCore/components/Description/Description.vue'
import Rooms from '@/views/ListingView/components/ListingCore/components/Rooms/Rooms.vue'

//CONTENT
const data = await listingCore()
</script>

<template>
  <section id="listing-core">
    <Title :data="data.title" />
    <Perks :data="data.perks" />
    <HostProfile :data="data.hostProfile" />
    <Description :data="data.description" />
    <div>
      <Rooms :data="data.rooms" />
    </div>
    <DatePicker />
  </section>
</template>

<style lang="scss">
@use '@/views/ListingView/components/ListingCore/listing-core.scss';
</style>
