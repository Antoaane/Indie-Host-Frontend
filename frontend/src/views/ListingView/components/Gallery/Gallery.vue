<!-- File: src/views/ListingView/components/Gallery/Gallery.vue -->

<script setup lang="ts">
// DEPS
import { computed } from 'vue'
import type { SwiperOptions } from 'swiper/types'
import { Swiper, SwiperSlide } from 'swiper/vue'
// COMPONENTS
import Mosaic from './components/Mosaic/Mosaic.vue'
// UTILS
import { createListingMediaSwiperParams } from '@/utils/swiper/listingMedia'
import { fancyboxShow } from '@/views/ListingView/components/Gallery/utils/fancybox'
import { orderByIndex } from '@/views/ListingView/components/Gallery/utils/order'
import type { Item } from '@/views/ListingView/components/Gallery/utils/types'
import type { MediasModel } from '@/views/ListingView/types/listing'
import { useListingViewport } from '@/views/ListingView/composables/useListingViewport'

const props = withDefaults(
  defineProps<{
    medias: MediasModel
    previewOnly?: boolean
  }>(),
  { previewOnly: false },
)

const { isLg } = useListingViewport()

const orderedImages = computed(() => orderByIndex(props.medias.images))

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

function openSlideLightbox(startIndexRaw: number) {
  if (!lightboxPayload.value.length) return
  const startIndex = Math.max(0, Math.min(startIndexRaw, lightboxPayload.value.length - 1))
  fancyboxShow(lightboxPayload.value, startIndex)
}

const slides = computed(() => orderedImages.value)

const swiperBaseParams = createListingMediaSwiperParams({
  autoplay: false,
  slidesPerView: 1,
  spaceBetween: 0,
  centeredSlides: true,
  pagination: {
    clickable: true,
  },
  navigation: false,
}) satisfies SwiperOptions

const swiperParams = swiperBaseParams as unknown as Record<string, unknown>
</script>

<template>
  <section
    v-if="isLg"
    class="listing-gallery"
  >
    <div
      v-if="coverImage"
      class="cover"
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
      :minSlots="props.previewOnly ? Math.min(6, mosaicImages.length || 2) : 2"
      :maxSlots="props.previewOnly ? Math.max(6, mosaicImages.length || 3) : 3"
      :minTileW="20"
      :minTileH="20"
    />
  </section>

  <section
    v-if="!isLg"
    class="listing-gallery"
  >
    <Swiper
      ref="swiperWrapper"
      v-bind="swiperParams"
    >
      <SwiperSlide
        v-for="(slide, slideIndex) in slides"
        :key="slide.position"
      >
        <img
          class="slide-page-svg"
          loading="lazy"
          :src="slide.src"
          :alt="slide.alt"
          @click="openSlideLightbox(slideIndex)"
        />
      </SwiperSlide>
    </Swiper>
  </section>
</template>

<style lang="scss">
@use '@/views/ListingView/components/Gallery/gallery.scss';
</style>
