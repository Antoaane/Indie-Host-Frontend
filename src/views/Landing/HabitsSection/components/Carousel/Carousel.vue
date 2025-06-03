<!-- File: src/views/Landing/HabitsSection/components/Carousel/Carousel.vue -->

<script setup lang="ts">
// DEPS
import { ref, computed, onMounted } from 'vue'
import type { Swiper as SwiperClass } from 'swiper'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Autoplay, type SwiperOptions } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/autoplay'

// UTILS
import { vp } from '@/utils/viewport'
import { useHabitsAnim } from '@/views/Landing/HabitsSection/utils/useHabitsAnim'
import { illustrationSize, descriptionSize } from '@/views/Landing/HabitsSection/stores/slider'

// ASSETS

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
const swiperParams = computed<SwiperOptions>(() => ({
  modules: [
    Autoplay,
  ],
  direction: vp.lg.value ? 'vertical' : 'horizontal',
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
}))

const initIllustrationSize = () => {
  setTimeout(() => {
    illustrationSize.value = illustrationRef.value?.clientHeight || 0
  }, 100)
}
</script>

<template>
  <div
    class="illustration"
    ref="illustrationRef"
    :style="`transform: translateY(-${vp.lg.value ? 0 : descriptionSize + 16}px)`"
  >
    <div
      class="carousel"
      ref="carouselRef"
      :style="`margin-left: ${(illustrationSize * 0.125) / 2}px`"
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
        <SwiperSlide>
          <img
            class="slide-page-svg"
            src="@/assets/media/images/dashboard-vue-ensemble.png"
            alt="Page réservations"
          />
        </SwiperSlide>
        <SwiperSlide>
          <img
            class="slide-page-svg"
            src="@/assets/media/images/dashboard-detail-logement.png"
            alt="Page réservations"
          />
        </SwiperSlide>
        <SwiperSlide>
          <img
            class="slide-page-svg"
            src="@/assets/media/images/annonce-reservation.png"
            alt="Page paiement"
          />
        </SwiperSlide>
        <SwiperSlide>
          <img
            class="slide-page-svg"
            src="@/assets/media/images/messagerie.png"
            alt="Page messagerie"
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
@use '@/views/Landing/HabitsSection/components/Carousel/carousel.scss';
</style>
