<!-- File: src/views/ListingView/components/Gallery/Gallery.vue -->

<script setup lang="ts">
// COMPONENTS
import Mosaic from './components/Mosaic/Mosaic.vue'

// CONTENT
import media from '@/content/fr/ListingTest/medias.json'
</script>

<template>
  <section class="gallery">
    <div class="cover-image">
      <img
        :src="media.images[0].src"
        :alt="media.images[0].alt"
      />
    </div>
    <Mosaic
      :items="media.images"
      :intervalMs="5000"
      :minSlots="2"
      :maxSlots="4"
      :minTileW="45"
      :minTileH="20"
    />
  </section>
</template>

<style lang="scss">
@use '@/views/ListingView/components/Gallery/gallery.scss';
</style>
