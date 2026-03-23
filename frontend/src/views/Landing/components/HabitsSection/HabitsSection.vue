<!-- File: src/views/Landing/components/HabitsSection/HabitsSection.vue -->

<script setup lang="ts">
// COMPONENTS
import SlidesTitles from '@/views/Landing/components/HabitsSection/components/SlidesTitles/SlidesTitles.vue'
import Carousel from '@/views/Landing/components/HabitsSection/components/Carousel/Carousel.vue'
// DEPS
import { computed } from 'vue'
// UTILS
import { vp } from '@/utils/viewport'
// CONTENT
import type { HabitsContent, HabitsSlide } from '@/views/Landing/types/content'

const props = defineProps<{
  content: HabitsContent
  slides?: HabitsSlide[]
}>()

const slides = computed(() => props.slides ?? props.content.slides ?? [])
</script>

<template>
  <div class="habits-section-container">
    <section id="habits-section">
      <div class="overflow">
        <div class="wrapper">
          <div class="section-heading">
            <h2 v-html="props.content.title" />
          </div>
          <Carousel
            v-if="vp.lg.value"
            :slides="slides"
          />
          <SlidesTitles :slides="slides" />
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
