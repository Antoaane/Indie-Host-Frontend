<!-- File: src/views/Landing/HabitsSection/components/Carousel.vue -->

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
    console.log('illustrationSize', illustrationSize.value)
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

<style scoped lang="scss">
@use '@/assets/styles/variables/globals' as *;

.illustration {
  display: flex;
  justify-content: center;

  .carousel {
    position: relative;

    #shadow {
      width: 125%;
      height: 120%;

      display: none !important;

      position: absolute;
      left: 50%;
      top: 50%;
      z-index: 9;

      transform: translate(-50%, -50%);
      transform-origin: center;

      display: none !important;
      justify-content: center;
      align-items: center;

      pointer-events: none;

      --shadow-pos-x: 0%;
      --shadow-pos-y: 50%;
      --shadow-end: 50%;
      --shadow-start: 30%;
      --shadow-size: 300% 50%;

      background: radial-gradient(var(--shadow-size) at var(--shadow-pos-x) var(--shadow-pos-y), rgba(17, 17, 23, 0) var(--shadow-start), #111117 var(--shadow-end));
      // background: rgba(255, 0, 0, 0.811);
      transition: none !important;

      @include min-width(lg) {
        display: flex !important;

        --shadow-pos-x: 100%;
        --shadow-pos-y: 50%;
        --shadow-size: 190% 50%;
        --shadow-start: 20%;
        --shadow-end: 50%;
      }

      #light {
        width: calc(100% / 12.5 * 10);
        height: calc(100% / 12 * 10);

        position: relative;

        transform-origin: center;

        & > [id^='line_'] {
          position: absolute;
          opacity: 50%;
        }

        #halo {
          width: 100%;
          height: calc((100% / 3) - (1rem / 3 * 2) * 2);

          position: absolute;
          top: 50%;
          left: 0;

          transform: translateY(-50%);

          border-radius: 0.75rem;
          box-shadow: 10px 10px 35px 0px rgba($accent, 0.15);
        }

        #line_1 {
          width: 125%;
          height: 1px;

          top: calc((100% / 3) + (2rem / 3));
          right: 0;

          background: linear-gradient(to left, rgba(252, 250, 250, 0) 9.43895%, rgba(252, 250, 250, 1) 48.5999%, rgba(252, 250, 250, 1) 77.7474%, rgba(252, 250, 250, 0) 100%);
        }

        #line_2 {
          width: 1px;
          height: 55%;

          top: 50%;
          left: 0;

          transform: translateY(-50%);

          background: linear-gradient(to bottom, rgba(252, 250, 250, 0) 0%, rgba(252, 250, 250, 1) 20.7365%, rgba(252, 250, 250, 1) 79.0715%, rgba(252, 250, 250, 0) 100%);
        }

        #line_3 {
          width: 125%;
          height: 1px;

          bottom: calc((100% / 3) + (2rem / 3)) !important;
          right: 0;

          background: linear-gradient(to left, rgba(252, 250, 250, 0) 9.43895%, rgba(252, 250, 250, 1) 48.5999%, rgba(252, 250, 250, 1) 77.7474%, rgba(252, 250, 250, 0) 100%);
        }
      }
    }

    .swiper {
      height: auto;
      width: 250vw;

      position: relative;
      left: 50%;
      overflow: visible;

      transform: translateX(-50%);

      @include min-width(sm) {
        width: 150vw;
      }

      @include min-width(lg) {
        width: auto;
        height: 130vh;

        position: static;
        transform: none;
        overflow: visible;
      }

      .swiper-wrapper {
        .swiper-slide {
          display: flex;
          justify-content: center;
          align-items: center;

          border-radius: 0.75rem;
          border-color: rgba($accent, 0);
          border-style: solid;
          border-width: 1px;

          transition: none !important;
          @include halo;

          .slide-page-svg {
            width: 100%;
            height: auto;

            border-radius: 0.75rem;

            @include min-width(lg) {
              width: auto !important;
              height: 100% !important;
            }
          }

          &.aswiper-slide-ctive {
            transition: transform-origin 0.3s ease-in-out;
          }
        }
      }
    }
  }
}
</style>
