<!-- File: src/views/Landing/components/HabitsSection/components/Carousel/Carousel.vue -->

<script setup lang="ts">
// DEPS
import { ref, computed, onMounted } from 'vue'
import type { SwiperOptions } from 'swiper/types'
import type { SwiperModule } from 'swiper/types'
import type { Swiper as SwiperClass } from 'swiper'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Autoplay } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/autoplay'
// UTILS
import { vp } from '@/utils/viewport'
import { useHabitsAnim } from '@/views/Landing/components/HabitsSection/utils/useHabitsAnim'
import { illustrationSize, descriptionSize } from '@/views/Landing/components/HabitsSection/stores/slider'
// CONTENT
import type { ItemSection } from '@/content/types'
import rawContent from '@/content/fr/Landing/habits-section.json'

const section = rawContent as ItemSection

const swiperInstance = ref<SwiperClass | null>(null)
const swiperWrapper = ref<InstanceType<typeof Swiper> | null>(null)
const carouselRef = ref<HTMLElement | null>(null)
const lightRef = ref<HTMLElement | null>(null)
const shadowRef = ref<HTMLElement | null>(null)
const illustrationRef = ref<HTMLElement | null>(null)

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
      ], // cast sinon unknown[]

      direction: (vp.lg.value ? 'vertical' : 'horizontal') as 'vertical' | 'horizontal',

      slidesPerView: 3,
      spaceBetween: vp.lg.value ? 32 : 16,

      autoplay: {
        delay: 3000,
        disableOnInteraction: true,
      },

      loop: true,
      centeredSlides: true,
      pagination: false,
      navigation: false,
    }) satisfies SwiperOptions,
)

const initIllustrationSize = () => {
  setTimeout(() => {
    illustrationSize.value = illustrationRef.value?.clientHeight || 0
  }, 100)
}
</script>

<template>
  <!-- <div
    class="illustration"
    ref="illustrationRef"
    :style="`transform: translateY(-${vp.lg.value ? 0 : descriptionSize + 24}px)`"
  > -->
  <div
    class="illustration"
    ref="illustrationRef"
  >
    <div
      class="carousel"
      ref="carouselRef"
      :style="vp.lg.value ? `margin-left: ${(illustrationSize * 0.125) / 2}px` : ''"
    >
      <Swiper
        ref="swiperWrapper"
        v-bind="swiperParams"
        @swiper="
          (e) => {
            onSwiperInit(e), initIllustrationSize()
          }
        "
        @slideChange="onSlideChange"
      >
        <SwiperSlide
          v-for="(data, idx) in section.items['slider'].meta?.data"
          :key="idx"
        >
          <img
            class="slide-page-svg"
            :src="data.image"
            :alt="data.alt"
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
