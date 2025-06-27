<!-- File: src/views/Landing/components/HabitsSection/HabitsSection.vue -->

<script setup lang="ts">
// COMPONENTS
import SlidesTitles from '@/views/Landing/components/HabitsSection/components/SlidesTitles/SlidesTitles.vue'
import Carousel from '@/views/Landing/components/HabitsSection/components/Carousel/Carousel.vue'
// UTILS
import { vp } from '@/utils/viewport'
// ASSETS
import { X } from 'lucide-vue-next'
</script>

<template>
  <div class="habits-section-container">
    <section id="habits-section">
      <div class="overflow">
        <div class="container">
          <Carousel v-if="vp.lg.value" />
          <SlidesTitles />
        </div>
      </div>
      <!-- Slide en grand -->
      <div
        id="slideDisplayRef"
        class="slide-display"
      />
    </section>
  </div>
</template>

<style lang="scss">
@use '@/views/Landing/components/HabitsSection/habits-section.scss';
</style>
