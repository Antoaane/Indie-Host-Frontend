<!-- File: src/views/Landing/components/HabitsSection/components/SlidesTitles/SlidesTitles.vue -->

<script setup lang="ts">
// DEPS
import { activeSlideIndex, sliderContainerSize, descriptionSize } from '@/views/Landing/components/HabitsSection/stores/slider'
import { onMounted, ref, computed } from 'vue'
import Carousel from '@/views/Landing/components/HabitsSection/components/Carousel/Carousel.vue'
// UTILS
import { vp } from '@/utils/viewport'
import { set } from '@vueuse/core'
// TYPES
import type { HabitsSlide } from '@/views/Landing/types/content'

const props = defineProps<{
  slides: HabitsSlide[]
}>()

const slides = computed(() => props.slides ?? [])

const descriptionRef = ref<HTMLElement | null>(null)
const modSize = ref<number>(0)

onMounted(() => {
  setTimeout(() => {
    descriptionRef.value?.classList.add('active')
    descriptionSize.value = descriptionRef.value?.clientHeight || 0
    modSize.value = sliderContainerSize.value * 0.12 * 0.5
  }, 150)
})
</script>

<template>
  <div
    class="content"
    :style="vp.lg.value ? `padding-right: ${modSize}px !important;` : ``"
  >
    <div class="slides-titles">
      <Carousel
        v-if="!vp.lg.value"
        :slides="slides"
      />
      <div ref="descriptionRef">
        <p
          v-for="(slide, idx) in slides"
          :key="slide.id"
          v-html="slide.description"
          :class="['description', { active: idx === activeSlideIndex }]"
          aria-live="polite"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss">
@use '@/views/Landing/components/HabitsSection/components/SlidesTitles/slides-titles.scss';
</style>
