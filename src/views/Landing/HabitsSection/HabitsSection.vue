<!-- File: src/views/Landing/HabitsSection/HabitsSection.vue -->

<script setup lang="ts">
// Import composants
import SlidesTitles from '@/views/Landing/HabitsSection/components/SlidesTitles/SlidesTitles.vue'
import Carousel from '@/views/Landing/HabitsSection/components/Carousel/Carousel.vue'
</script>

<template>
  <div class="habits-section-container">
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
  </div>
</template>

<style lang="scss">
@use '@/views/Landing/HabitsSection/habits-section.scss';
</style>
