<!-- File: src/views/ListingView/ListingView.vue -->

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { ScrollSmoother } from 'gsap/ScrollSmoother'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import gsap from 'gsap'
import { vp } from '@/utils/viewport'
import Gallery from '@/views/ListingView/components/Gallery/Gallery.vue'

if (vp.lg.value) {
  gsap.registerPlugin(ScrollTrigger, ScrollSmoother)
}

// let smoother: ReturnType<typeof ScrollSmoother.create>

onMounted(() => {
  // if (vp.lg.value) {
  //   smoother = ScrollSmoother.create({
  //     smooth: 1.2,
  //     effects: true,
  //   })
  // }
})

onBeforeUnmount(() => {
  // if (vp.lg.value) smoother.kill()
})
</script>

<template>
  <div class="listing-view">
    <div class="gallery-container">
      <Gallery />
    </div>

    <div>
      <!-- autres blocs -->
    </div>
  </div>
</template>

<style lang="scss">
@use '@/views/ListingView/listing-view.scss';
</style>
