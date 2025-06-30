<!-- File: src/views/Landing/_LandingPage.vue -->

<script setup lang="ts">
// DEPS
import { onMounted, onBeforeUnmount } from 'vue'
import { ScrollSmoother } from 'gsap/ScrollSmoother'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import gsap from 'gsap'
// UTILS
import { vp } from '@/utils/viewport'
// COMPONENTS

if (vp.lg.value) {
  gsap.registerPlugin(ScrollTrigger, ScrollSmoother)
}

let smoother: ReturnType<typeof ScrollSmoother.create>

onMounted(() => {
  if (vp.lg.value) {
    smoother = ScrollSmoother.create({
      // wrapper: 'body',
      // content: '#landing-page',
      smooth: 1.2,
      effects: true,
    })
  }
})

onBeforeUnmount(() => {
  if (vp.lg.value) {
    smoother.kill()
  }
})
</script>

<template>
  <main id="listing-page">
    <!-- <gallery-component /> -->
    <!-- <listing-core-component /> -->
    <div>
      <!-- <comments-component /> -->
      <!-- <checkout-min-component /> -->
    </div>
  </main>
</template>
