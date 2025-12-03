<!-- File: src/views/Listing/_Listing.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
// COMOOENENTS
import ListingView from '@/views/ListingView/ListingView.vue'

const route = useRoute()
const listingKey = computed(() => {
  const slug = route.params.slug
  if (typeof slug === 'string' && slug.trim()) return slug.trim()
  if (Array.isArray(slug) && slug[0]?.trim()) return slug[0].trim()
  return 'default-listing'
})
</script>

<template>
  <main id="listing-page">
    <div class="sub-container">
      <ListingView :key="listingKey" />
    </div>
  </main>
</template>

<style lang="scss">
@use '@/views/Listing/listing.scss';
</style>
