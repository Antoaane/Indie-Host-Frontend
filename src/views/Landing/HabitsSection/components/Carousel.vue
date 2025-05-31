<!-- File: src/views/Landing/HabitsSection/components/Carousel.vue -->

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Autoplay } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/autoplay'

import { useHabitsAnim } from '../utils/useHabitsAnim'

const swiperInstance = ref<InstanceType<typeof Swiper> | null>(null)
const carouselRef = ref<HTMLElement | null>(null)
const lightRef = ref<HTMLElement | null>(null)
const shadowRef = ref<HTMLElement | null>(null)

const { onSwiperInit, onSlideChange } = useHabitsAnim({
  swiperInstance,
  carouselRef,
  lightRef,
  shadowRef,
})

// Params Swiper en reactive/computed
const swiperParams = computed(() => ({
  modules: [
    Autoplay,
  ],
  direction: window.innerWidth > 1024 ? 'vertical' : 'horizontal',
  slidesPerView: 3,
  // slidesPerView: window.innerWidth > 1024 ? 3 : 1,
  spaceBetween: window.innerWidth > 1024 ? 32 : 16,
  autoplay: {
    delay: 2000,
    disableOnInteraction: true,
  },
  loop: true,
  centeredSlides: true,
  pagination: false,
  navigation: false,
}))
</script>

<template>
  <div class="illustration">
    <div
      class="carousel"
      ref="carouselRef"
    >
      <Swiper
        ref="swiperInstance"
        v-bind="swiperParams"
        @swiper="onSwiperInit"
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

<!-- <style scoped lang="scss">
@use '@/assets/styles/variables/globals' as *;
@use '@/assets/styles/variables/effects' as effect;
@use '@/assets/styles/variables/borders' as borders;
@use '@/assets/styles/variables/animations' as animations;

.illustration {
  display: flex;
  justify-content: center;

  @include min-width(lg) {
    width: 50%;
  }

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
      --shadow-size: 190% 50%;
      --shadow-start: 20%;
      --shadow-end: 50%;

      background: radial-gradient(var(--shadow-size) at var(--shadow-pos-x) var(--shadow-pos-y), rgba(17, 17, 23, 0) var(--shadow-start), #111117 var(--shadow-end));
      // background: rgba(255, 0, 0, 0.811);
      transition: none !important;

      @include min-width(lg) {
        display: flex !important;
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
          right: 0;

          transform: translateY(-50%);

          border-radius: 0.75rem;
          box-shadow: 10px 10px 35px 0px rgba($accent, 0.15);
        }

        #line_1 {
          width: 125%;
          height: 1px;

          top: calc((100% / 3) + (2rem / 3));

          background: linear-gradient(to right, rgba(252, 250, 250, 0) 9.43895%, rgba(252, 250, 250, 1) 48.5999%, rgba(252, 250, 250, 1) 77.7474%, rgba(252, 250, 250, 0) 100%);
        }

        #line_2 {
          width: 1px;
          height: 55%;

          top: 50%;
          right: 0;

          transform: translateY(-50%);

          background: linear-gradient(to bottom, rgba(252, 250, 250, 0) 0%, rgba(252, 250, 250, 1) 20.7365%, rgba(252, 250, 250, 1) 79.0715%, rgba(252, 250, 250, 0) 100%);
        }

        #line_3 {
          width: 125%;
          height: 1px;

          bottom: calc((100% / 3) + (2rem / 3)) !important;

          background: linear-gradient(to right, rgba(252, 250, 250, 0) 9.43895%, rgba(252, 250, 250, 1) 48.5999%, rgba(252, 250, 250, 1) 77.7474%, rgba(252, 250, 250, 0) 100%);
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
</style> -->
