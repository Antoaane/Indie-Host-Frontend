<!-- File: src/views/Landing/HabitsSection/HabitsSection.vue -->

<script setup lang="ts">
// Import composants
import SlidesTitles from '@/views/Landing/HabitsSection/components/SlidesTitles.vue'
import Carousel from '@/views/Landing/HabitsSection/components/Carousel/Carousel.vue'
</script>

<template>
  <section id="habits-section">
    <div class="overflow">
      <div class="container">
        <Carousel />
        <SlidesTitles />
      </div>
    </div>
    <!-- Slide en grand -->
    <div
      id="slideDisplayRef"
      class="slide-display"
    >
    </div>
  </section>
</template>

<style lang="scss">
@use '@/assets/styles/variables/globals' as *;
@use '@/assets/styles/variables/borders' as borders;

#habits-section {
  padding-top: calc(150vh + (var(--gutter-spacing) + 70px));

  .overflow {
    width: 100%;
    display: flex;
    justify-content: center;
    overflow: hidden;

    .container {
      display: flex;
      flex-direction: column-reverse;
      gap: 2rem;

      @include min-width(lg) {
        height: 80vh;
        gap: 3rem;

        flex-direction: row;
        align-items: center;
        justify-content: flex-end;
      }

      @include container(xxl, 5rem);
      @include gutters(padding, inline, 2);
    }

    .slide-display {
      width: 100vw;
      height: 100vh;

      display: flex;
      justify-content: center;
      align-items: center;

      position: fixed;
      top: 50%;
      left: 50%;
      z-index: -999;

      transform: translate(-50%, -50%);
      opacity: 0;
      background-color: rgba($secondary, 0.85);

      &:has(svg),
      &:has(img) {
        z-index: 9999;
      }

      img {
        max-width: 95vw;
        max-height: 95vh;

        border-radius: borders.$rounded-xl;
        border: 1px solid rgba($accent, 1);

        @include min-width(lg) {
          max-width: 85vw;
          max-height: 90vh;
        }

        @include halo(lg);
      }
    }
  }
}
</style>
