<!-- File: src/views/Listing/_Listing.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
// COMOOENENTS
import ListingView from '@/views/ListingView/ListingView.vue'

const route = useRoute()
const listingKey = computed(() => {
  const id = route.params.id
  if (typeof id === 'string' && id.trim()) return id.trim()
  if (Array.isArray(id) && id[0]?.trim()) return id[0].trim()
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
