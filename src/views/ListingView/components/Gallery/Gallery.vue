<!-- File: src/views/ListingView/components/Gallery/Gallery.vue -->

<script setup lang="ts">
import { computed } from 'vue'
// COMPONENTS
import Mosaic from './components/Mosaic/Mosaic.vue'
// UTILS
import { fancyboxShow } from '@/views/ListingView/components/Gallery/utils/fancybox'
import { orderByIndex } from '@/views/ListingView/components/Gallery/utils/order'
import type { Item } from '@/views/ListingView/components/Gallery/utils/types'
// CONTENT
import media from '@/content/fr/ListingTest/medias.json'

const coverImage = computed(() => media.images.find((img) => img.cover === true))
const mosaicImages = computed(() => media.images.filter((img) => !img.cover))

const lightboxItems = computed<Item[]>(() => {
  const base: Item[] = []
  if (coverImage.value) base.push(coverImage.value)
  base.push(...mosaicImages.value)
  return orderByIndex(base)
})

const lightboxPayload = computed(() => lightboxItems.value.map((img) => ({ src: img.src, type: 'image', alt: img.alt })))

function openCoverLightbox() {
  if (!coverImage.value) return
  const startIndex = Math.max(
    0,
    lightboxItems.value.findIndex((img) => img.src === coverImage.value?.src),
  )
  fancyboxShow(lightboxPayload.value, startIndex)
}
</script>

<template>
  <section class="gallery">
    <div
      v-if="coverImage"
      class="cover-image"
      role="button"
      tabindex="0"
      @click="openCoverLightbox"
      @keydown.enter.prevent="openCoverLightbox"
      @keydown.space.prevent="openCoverLightbox"
    >
      <img
        :src="coverImage.src"
        :alt="coverImage.alt"
      />
    </div>
    <Mosaic
      :items="mosaicImages"
      :lightbox-items="lightboxItems"
      :intervalMs="10000"
      :minSlots="3"
      :maxSlots="4"
      :minTileW="45"
      :minTileH="45"
    />
  </section>
</template>

<style lang="scss">
@use '@/views/ListingView/components/Gallery/gallery.scss';
</style>
