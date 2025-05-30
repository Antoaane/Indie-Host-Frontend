<!-- File: src/views/Landing/HabitsSection/index.vue -->

<script setup lang="ts">
// Import composants
import SlidesTitles from './components/SlidesTitles.vue'
import Carousel from './components/Carousel.vue'
</script>

<template>
  <section id="habits-section">
    <div class="container">
      <SlidesTitles />
      <Carousel />
    </div>
  </section>
</template>

<style lang="scss" scoped>
@use './style.scss';
</style>
