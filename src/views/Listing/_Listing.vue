<!-- File: src/views/Listing/_Listing.vue -->

<script setup lang="ts">
// COMOOENENTS
import ListingView from '@/views/ListingView/ListingView.vue'
</script>

<template>
  <main id="listing-page">
    <div class="sub-container">
      <ListingView />
    </div>
  </main>
</template>

<style lang="scss">
@use '@/views/Listing/listing.scss';
</style>
