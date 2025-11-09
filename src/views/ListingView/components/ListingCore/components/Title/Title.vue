<!-- File: src/views/ListingView/components/ListingCore/components/Title/Title.vue -->

<script setup lang="ts">
// DEPS
// CONTENT
import core from '@/content/fr/ListingTest/core.json'

const props = defineProps<{
  title: string
  type: string
  location: { city: string; region: string; country: string }
  capacity: number
  bedrooms: { quantity: number; bed: number }
  bathrooms: number
}>()
</script>

<template>
  <div class="title">
    <h1>
      {{ title }}
    </h1>
    <h2> {{ type }} — {{ location.city }}, {{ location.country }} </h2>
    <ul>
      <li> {{ capacity }} voyageur{{ capacity > 1 ? 's' : '' }} </li
      ><span></span>
      <li> {{ bedrooms.quantity }} chambres </li
      ><span></span>
      <li> {{ bedrooms.bed }} chambres </li
      ><span></span>
      <li> {{ bathrooms }} salles de bain </li>
    </ul>
  </div>
</template>

<style lang="scss">
@use '@/views/ListingView/components/ListingCore/components/Title/title.scss';
</style>
