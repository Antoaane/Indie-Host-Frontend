<!-- File: src/views/ListingView/components/Gallery/Gallery.vue -->

<script setup lang="ts">
// DEPS
import { computed } from 'vue'
import type { SwiperOptions } from 'swiper/types'
import type { SwiperModule } from 'swiper/types'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Autoplay, Pagination } from 'swiper/modules'
// COMPONENTS
import Mosaic from './components/Mosaic/Mosaic.vue'
// UTILS
import { vp } from '@/utils/viewport'
import { fancyboxShow } from '@/views/ListingView/components/Gallery/utils/fancybox'
import { orderByIndex } from '@/views/ListingView/components/Gallery/utils/order'
import type { Item } from '@/views/ListingView/components/Gallery/utils/types'
// CONTENT
import { listingCore } from '@/views/ListingView/utils/useParseContent'

const { medias } = await listingCore()

const orderedImages = computed(() => orderByIndex(medias.images))

const coverImage = computed(() => orderedImages.value.find((img) => (img.position ?? 0) === 0) ?? orderedImages.value[0])
const mosaicImages = computed(() => orderedImages.value.filter((img) => img !== coverImage.value))

const lightboxItems = computed<Item[]>(() => {
  return orderedImages.value
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

const slides = computed(() => orderedImages.value)
console.log('slides', slides)

const swiperParams = computed(
  () =>
    ({
      modules: [
        Autoplay as SwiperModule,
        Pagination as SwiperModule,
      ],

      direction: 'horizontal',

      slidesPerView: 1,
      spaceBetween: 0,

      // autoplay: {
      //   delay: 3000,
      //   disableOnInteraction: true,
      // },

      pagination: {
        clickable: true,
      },

      // loop: true,
      centeredSlides: true,
      navigation: false,
    }) satisfies SwiperOptions,
)
</script>

<template>
  <section
    v-if="vp.lg.value"
    class="gallery"
  >
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

  <section
    v-if="!vp.lg.value"
    class="gallery"
  >
    <Swiper
      ref="swiperWrapper"
      v-bind="swiperParams"
    >
      <SwiperSlide
        v-for="slide in slides"
        :key="slide.position"
      >
        <img
          class="slide-page-svg"
          loading="lazy"
          :src="slide.src"
          :alt="slide.alt"
        />
      </SwiperSlide>
    </Swiper>
  </section>
</template>

<style lang="scss">
@use '@/views/ListingView/components/Gallery/gallery.scss';
</style>
