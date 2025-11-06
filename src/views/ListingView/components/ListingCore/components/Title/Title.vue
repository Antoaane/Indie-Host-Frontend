<!-- File: src/views/ListingView/components/ListingCore/components/Title/Title.vue -->

<script setup lang="ts">
// DEPS
// CONTENT
import core from '@/content/fr/ListingTest/core.json'

const props = defineProps<{
  title: string
  location: string
  capacity: number
  bedrooms: { quantity: number; bed: number }
  bathrooms: number
}>()
</script>

<template>
  <h1>
    {{ title }}
  </h1>
  <h2>
    {{ location }}
  </h2>
  <ul>
    <li> {{ capacity }} voyageur{{ capacity > 1 ? 's' : '' }} </li>
    <li> {{ bedrooms.quantity }} chambres </li>
    <li> {{ bedrooms.bed }} chambres </li>
    <li> {{ bathrooms }} salles de bain </li>
  </ul>
</template>

<style lang="scss">
@use '@/views/ListingView/components/ListingCore/components/Title/title.scss';
</style>
