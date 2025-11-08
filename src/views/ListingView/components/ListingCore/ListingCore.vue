<!-- File: src/views/ListingView/components/ListingCore/ListingCore.vue -->

<script setup lang="ts">
// DEPS

// UTILS
import { vp } from '@/utils/viewport'
import { listingCore } from '@/views/ListingView/utils/useParseContent'

// COMPONENTS
import Title from '@/views/ListingView/components/ListingCore/components/Title/Title.vue'
import DatePicker from '@/views/ListingView/components/ListingCore/components/DatePicker/DatePicker.vue'

//CONTENT
const data = await listingCore()
const title = data.title // <- accès direct demandé
console.log(title)
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
    <DatePicker />
  </section>
</template>

<style lang="scss">
@use '@/views/ListingView/components/ListingCore/listing-core.scss';
</style>
