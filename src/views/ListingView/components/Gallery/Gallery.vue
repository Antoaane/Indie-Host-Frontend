<!-- File: src/views/ListingView/components/Gallery/Gallery.vue -->

<script setup lang="ts">
// COMPONENTS
import Mosaic from './components/Mosaic/Mosaic.vue'

// CONTENT
import media from '@/content/fr/ListingTest/medias.json'
</script>

<template>
  <section class="gallery">
    <Mosaic
      :items="media.images"
      :intervalMs="5000"
      :minSlots="3"
      :maxSlots="6"
      :minTileW="100"
      :minTileH="20"
    />
  </section>
</template>

<style lang="scss">
@use '@/views/ListingView/components/Gallery/gallery.scss';
</style>
