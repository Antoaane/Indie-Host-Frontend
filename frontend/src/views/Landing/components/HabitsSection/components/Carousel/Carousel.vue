<!-- File: src/views/Landing/components/HabitsSection/components/Carousel/Carousel.vue -->

<script setup lang="ts">
// DEPS
import { ref, computed, onMounted } from 'vue'
import type { SwiperOptions } from 'swiper/types'
import type { SwiperModule } from 'swiper/types'
import type { Swiper as SwiperClass } from 'swiper'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Autoplay, Pagination } from 'swiper/modules'

import 'swiper/css'
import 'swiper/css/autoplay'
import 'swiper/css/pagination'
// UTILS
import { vp } from '@/utils/viewport'
import { useHabitsAnim } from '@/views/Landing/components/HabitsSection/utils/useHabitsAnim'
import { sliderContainerSize, descriptionSize } from '@/views/Landing/components/HabitsSection/stores/slider'
// TYPES
import type { HabitsSlide } from '@/views/Landing/types/content'

const props = defineProps<{
  slides: HabitsSlide[]
}>()

const slides = computed(() => props.slides ?? [])

const swiperInstance = ref<SwiperClass | null>(null)
const swiperWrapper = ref<InstanceType<typeof Swiper> | null>(null)
const carouselRef = ref<HTMLElement | null>(null)
const lightRef = ref<HTMLElement | null>(null)
const shadowRef = ref<HTMLElement | null>(null)
const sliderContainerRef = ref<HTMLElement | null>(null)

const { onSwiperInit, onSlideChange } = useHabitsAnim({
  swiperInstance,
  carouselRef,
  lightRef,
  shadowRef,
})

// Params Swiper en reactive/computed
const swiperParams = computed(
  () =>
    ({
      modules: [
        Autoplay as SwiperModule,
        Pagination as SwiperModule,
      ],

      direction: (vp.lg.value ? 'vertical' : 'horizontal') as 'vertical' | 'horizontal',

      slidesPerView: 3,
      spaceBetween: vp.lg.value ? 32 : 16,

      autoplay: {
        delay: 3000,
        disableOnInteraction: true,
      },

      pagination: {
        clickable: true,
      },

      loop: true,
      centeredSlides: true,
      navigation: false,
    }) satisfies SwiperOptions,
)

const initsliderContainerSize = () => {
  setTimeout(() => {
    sliderContainerSize.value = sliderContainerRef.value?.clientHeight || 0
  }, 100)
}
</script>

<template>
  <!-- <div
    class="illustration"
    ref="sliderContainerRef"
    :style="`transform: translateY(-${vp.lg.value ? 0 : descriptionSize + 24}px)`"
  > -->
  <div
    class="slider-container"
    ref="sliderContainerRef"
  >
    <div
      class="carousel"
      ref="carouselRef"
      :style="vp.lg.value ? `margin-left: ${(sliderContainerSize * 0.125) / 2}px` : ''"
    >
      <Swiper
        ref="swiperWrapper"
        v-bind="swiperParams"
        @swiper="
          (e) => {
            onSwiperInit(e), initsliderContainerSize()
          }
        "
        @slideChange="onSlideChange"
      >
        <SwiperSlide
          v-for="slide in slides"
          :key="slide.id"
        >
          <img
            v-if="slide.images?.[0]?.webp"
            class="slide-page-svg"
            loading="lazy"
            :src="slide.images[0]?.webp"
            :onerror="slide.images[0]?.png ? `this.onerror=null; this.src='${slide.images[0]?.png}';` : undefined"
            :alt="slide.images[0]?.alt"
          />
          <img
            v-else
            class="slide-page-svg"
            loading="lazy"
            src="/assets/media/images/webp/editeur.webp"
            alt="Habits illustration"
          />
        </SwiperSlide>
      </Swiper>

      <!-- EFFETS DE LUMIÈRE -->
      <span
        id="shadow"
        ref="shadowRef"
      >
        <div
          id="light"
          ref="lightRef"
        >
          <span id="halo"></span>
          <span id="line_1"></span>
          <span id="line_2"></span>
          <span id="line_3"></span>
        </div>
      </span>
    </div>
  </div>
</template>

<style lang="scss">
@use '@/views/Landing/components/HabitsSection/components/Carousel/carousel.scss';
</style>
