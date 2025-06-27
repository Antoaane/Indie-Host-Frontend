<!-- File: src/views/Landing/_LandingPage.vue -->

<script setup lang="ts">
// DEPS
import { onMounted, onBeforeUnmount } from 'vue'
import { VueLenis } from 'lenis/vue'
import { ScrollSmoother } from 'gsap/ScrollSmoother'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import gsap from 'gsap'

// UTILS
import { vp } from '@/utils/viewport'

// ASSETS
import HeroSection from '@/views/Landing/HeroSection/HeroSection.vue'
import BenefitsSection from '@/views/Landing/BenefitsSection/BenefitsSection.vue'
import CustomizationSection from '@/views/Landing/CustomizationSection/CustomizationSection.vue'
import HabitsSection from '@/views/Landing/HabitsSection/HabitsSection.vue'
import StrengthsSection from '@/views/Landing/StrengthsSection/StrengthsSection.vue'
import UsageSection from '@/views/Landing/UsageSection/UsageSection.vue'
import JoinSection from '@/views/Landing/JoinSection/JoinSection.vue'
import FaqSection from '@/views/Landing/FaqSection/FaqSection.vue'

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
  <!-- <VueLenis root> -->
  <main id="landing-page">
    <HeroSection />
    <BenefitsSection />
    <HabitsSection />
    <CustomizationSection />
    <StrengthsSection />
    <UsageSection />
    <JoinSection />
    <FaqSection />
  </main>
  <!-- </VueLenis> -->
</template>
