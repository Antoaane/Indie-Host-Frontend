<!-- File: src/views/ListingView/components/Gallery/Gallery.vue -->

<script setup lang="ts">
import { computed } from 'vue'
// COMPONENTS
import Mosaic from './components/Mosaic/Mosaic.vue'

// CONTENT
import media from '@/content/fr/ListingTest/medias.json'

const coverImage = computed(() => media.images.find(img => img.cover === true))
const mosaicImages = computed(() => media.images.filter(img => !img.cover))
</script>

<template>
  <section class="gallery">
    <div
      v-if="coverImage"
      class="cover-image"
    >
      <img
        :src="coverImage.src"
        :alt="coverImage.alt"
      />
    </div>
    <Mosaic
      :items="mosaicImages"
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
