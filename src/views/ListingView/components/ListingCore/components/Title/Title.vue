<!-- File: src/views/ListingView/components/ListingCore/components/Title/Title.vue -->

<script setup lang="ts">
// TYPES
import type { TitleModel } from '@/views/ListingView/types/listing'
// CONTENT
import listing from '@/content/fr/_Static/lisitng.json'

const props = defineProps<{
  data: TitleModel
}>()

const content = listing.items
</script>

<template>
  <div class="title-listing__comp">
    <h1>
      {{ data.title }}
    </h1>
    <h2> {{ data.type }} — {{ data.location.city }}, {{ data.location.country }} </h2>
    <ul>
      <li> {{ data.capacity }} {{ data.capacity > 1 ? content.capacity.data.travelers : content.capacity.data.traveler }} </li>

      <li>
        <span></span>
        {{ data.bedrooms.quantity }} {{ data.bedrooms.quantity > 1 ? content.capacity.data.travelers : content.capacity.data.traveler }}
      </li>
      <li v-if="data.bedrooms.bed">
        <span></span>
        {{ data.bedrooms.bed }} {{ data.bedrooms.bed > 1 ? content.rooms.data.bedrooms : content.rooms.data.bedroom }}
      </li>
      <li>
        <span></span>
        {{ data.bathrooms }} {{ data.bathrooms > 1 ? content.rooms.data.bathrooms : content.rooms.data.bathroom }}
      </li>
    </ul>
  </div>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.title-listing__comp {
  h1 {
    @include h1-title;
  }

  h2 {
    @include h2-title;
  }

  h2 {
    font-weight: 400;
  }

  ul {
    display: flex;
    align-items: center;

    opacity: 0.65;

    li {
      display: inline-flex;
      align-items: center;

      span {
        height: 5px;
        width: 5px;
        margin-inline: 0.5rem;
        margin-top: 3px;

        background-color: $secondary;
        border-radius: borders.$rounded;
      }
    }
  }
}
</style>
