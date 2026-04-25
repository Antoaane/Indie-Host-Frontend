<!-- File: src/views/CreateListing/components/wizard/CreateListingStepsTabs.vue -->

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { Swiper as SwiperInstance } from 'swiper/types'
import type { SwiperModule, SwiperOptions } from 'swiper/types'
import { FreeMode, Mousewheel } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/vue'

import type { CreateListingStepItem } from '@/views/CreateListing/wizard/createListing.types'

const props = defineProps<{
  items: CreateListingStepItem[]
}>()

const emit = defineEmits<{
  (e: 'select', index: number): void
}>()

const STEP_SCROLL_TRANSITION_MS = 320

const swiperRef = ref<SwiperInstance | null>(null)

const activeStepIndex = computed(() => props.items.findIndex((item) => item.isActive))

const sliderParams = computed(
  () =>
    ({
      modules: [
        FreeMode as SwiperModule,
        Mousewheel as SwiperModule,
      ],
      slidesPerView: 'auto',
      spaceBetween: 6,
      freeMode: {
        enabled: true,
        sticky: true,
        momentum: true,
        momentumBounce: false,
        momentumRatio: 0.8,
        momentumVelocityRatio: 0.7,
      },
      mousewheel: {
        enabled: true,
        forceToAxis: true,
        sensitivity: 0.55,
        thresholdDelta: 2,
        releaseOnEdges: true,
      },
      centeredSlides: false,
      watchOverflow: true,
      resistanceRatio: 0.85,
      threshold: 6,
      speed: STEP_SCROLL_TRANSITION_MS,
    }) satisfies SwiperOptions,
)

function scrollToActiveStep(animated = true) {
  const swiper = swiperRef.value
  const total = props.items.length
  if (!swiper || !total) return

  const targetIndex = activeStepIndex.value >= 0 ? activeStepIndex.value : 0
  swiper.update()

  const slideStart = swiper.slidesGrid[targetIndex]
  const slideSize = swiper.slidesSizesGrid[targetIndex]
  const duration = animated ? STEP_SCROLL_TRANSITION_MS : 0

  if (!Number.isFinite(slideStart) || !Number.isFinite(slideSize)) {
    swiper.slideTo(targetIndex, duration)
    return
  }

  const centeredTranslate = -(slideStart + slideSize / 2 - swiper.width / 2)
  const clampedTranslate = Math.max(swiper.maxTranslate(), Math.min(swiper.minTranslate(), centeredTranslate))
  swiper.translateTo(clampedTranslate, duration, false, true)
}

function handleSwiper(instance: SwiperInstance) {
  swiperRef.value = instance
  nextTick(() => scrollToActiveStep(false))
}

watch(
  () => props.items.map((item) => `${item.id}:${item.isActive ? 1 : 0}`).join('|'),
  () => {
    nextTick(scrollToActiveStep)
  },
)
</script>

<template>
  <div class="steps">
    <Swiper
      class="swiper"
      v-bind="sliderParams"
      @swiper="handleSwiper"
    >
      <SwiperSlide
        v-for="item in props.items"
        :key="item.id"
        class="step-slide"
      >
        <button
          class="step"
          :class="{
            'is-active': item.isActive,
            'is-done': item.isDone,
          }"
          type="button"
          :disabled="item.isDisabled"
          @click="emit('select', item.index)"
        >
          <span>{{ item.index + 1 }}</span>
          <small>{{ item.label }}</small>
        </button>
      </SwiperSlide>
    </Swiper>
  </div>
</template>
