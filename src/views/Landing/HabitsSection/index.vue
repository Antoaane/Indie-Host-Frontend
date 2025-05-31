<!-- File: src/views/Landing/HabitsSection/index.vue -->

<script setup lang="ts">
// Import composants
import SlidesTitles from '@/views/Landing/HabitsSection/components/SlidesTitles.vue'
import Carousel from '@/views/Landing/HabitsSection/components/Carousel.vue'
</script>

<template>
  <section id="habits-section">
    <div class="container">
      <SlidesTitles />
      <Carousel />
    </div>
    <!-- Slide en grand -->
    <div
      id="slideDisplayRef"
      class="slide-display"
    ></div>
  </section>
</template>

<!-- <style lang="scss" scoped>
@use '@/views/Landing/HabitsSection/style.scss';
</style> -->
