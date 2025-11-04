<!-- File: src/views/ListingView/components/Gallery/Gallery.vue -->

<template>
  <section class="gallery">
    <!-- Exemple d’usage -->
    <Mosaic
      :items="items"
      :intervalMs="5000"
      :minSlots="2"
      :maxSlots="5"
      :minTileW="45"
      :minTileH="20"
    />
  </section>
</template>

<script setup lang="ts">
import Mosaic from './components/Mosaic/Mosaic.vue'
import './gallery.scss'

// Optionnel: laisse vide si tu veux utiliser les DEFAULT_IMAGES du composant
const items = [
  { image: '/assets/media/images/listing-test/image0.jpg', alt: '0' },
  { image: '/assets/media/images/listing-test/image1.jpg', alt: '1' },
  { image: '/assets/media/images/listing-test/image2.jpg', alt: '2' },
  { image: '/assets/media/images/listing-test/image3.jpg', alt: '3' },
  { image: '/assets/media/images/listing-test/image4.jpg', alt: '4' },
  { image: '/assets/media/images/listing-test/image5.jpg', alt: '5' },
  { image: '/assets/media/images/listing-test/image6.jpg', alt: '6' },
  { image: '/assets/media/images/listing-test/image7.jpg', alt: '7' },
  { image: '/assets/media/images/listing-test/image8.jpg', alt: '8' },
  { image: '/assets/media/images/listing-test/image9.jpg', alt: '9' },
  { image: '/assets/media/images/listing-test/image10.jpg', alt: '10' },
]
</script>
