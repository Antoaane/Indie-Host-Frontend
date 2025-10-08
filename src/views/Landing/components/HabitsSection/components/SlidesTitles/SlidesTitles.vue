<!-- File: src/views/Landing/components/HabitsSection/components/SlidesTitles/SlidesTitles.vue -->

<script setup lang="ts">
// DEPS
import { activeSlideIndex, illustrationSize, descriptionSize } from '@/views/Landing/components/HabitsSection/stores/slider'
import { onMounted, ref } from 'vue'
import Carousel from '@/views/Landing/components/HabitsSection/components/Carousel/Carousel.vue'
// UTILS
import { vp } from '@/utils/viewport'
import { set } from '@vueuse/core'
// CONTENT
import type { ItemSection } from '@/content/types'
import rawContent from '@/content/fr/Landing/habits-section.json'

const section = rawContent as ItemSection

const descriptionRef = ref<HTMLElement | null>(null)
const modSize = ref<number>(0)

onMounted(() => {
  setTimeout(() => {
    descriptionRef.value?.classList.add('active')
    descriptionSize.value = descriptionRef.value?.clientHeight || 0
    modSize.value = illustrationSize.value * 0.12 * 0.5
  }, 150)
})
</script>

<template>
  <div
    class="content"
    :style="vp.lg.value ? `padding-right: ${modSize}px !important;` : ``"
  >
    <h2 v-html="section.items['title-1'].content" />
    <div class="slides-titles">
      <!-- <div>
        <h3
          v-for="(txt, idx) in section.items['slider'].meta?.data"
          :key="idx"
          v-html="txt.title"
          :class="['title', { active: idx === activeSlideIndex }]"
          aria-live="polite"
        />
      </div> -->
      <Carousel v-if="!vp.lg.value" />
      <!-- <div ref="descriptionRef">
        <p
          v-for="(txt, idx) in section.items['slider'].meta?.data"
          :key="idx"
          v-html="txt.description"
          :class="['description', { active: idx === activeSlideIndex }]"
          aria-live="polite"
        />
      </div> -->
    </div>
  </div>
</template>

<style lang="scss">
@use '@/views/Landing/components/HabitsSection/components/SlidesTitles/slides-titles.scss';
</style>
