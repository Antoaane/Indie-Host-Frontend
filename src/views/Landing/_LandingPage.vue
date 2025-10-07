<!-- File: src/views/Landing/_LandingPage.vue -->

<script setup lang="ts">
// DEPS
import { defineAsyncComponent } from 'vue'
import { ScrollSmoother } from 'gsap/ScrollSmoother'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import gsap from 'gsap'
// UTILS
import { vp } from '@/utils/viewport'
// COMPONENTS
const HeroSection = defineAsyncComponent(() => import('./components/HeroSection/HeroSection.vue'))
const BenefitsSection = defineAsyncComponent(() => import('./components/BenefitsSection/BenefitsSection.vue'))
const CustomizationSection = defineAsyncComponent(() => import('./components/CustomizationSection/CustomizationSection.vue'))
const HabitsSection = defineAsyncComponent(() => import('./components/HabitsSection/HabitsSection.vue'))
const FeaturesSection = defineAsyncComponent(() => import('./components/FeaturesSection/FeaturesSection.vue'))
const StrengthsSection = defineAsyncComponent(() => import('./components/StrengthsSection/StrengthsSection.vue'))
const UsageSection = defineAsyncComponent(() => import('./components/UsageSection/UsageSection.vue'))
const JoinSection = defineAsyncComponent(() => import('./components/JoinSection/JoinSection.vue'))
const FaqSection = defineAsyncComponent(() => import('./components/FaqSection/FaqSection.vue'))

if (vp.lg.value) {
  gsap.registerPlugin(ScrollTrigger, ScrollSmoother)
}

let smoother: ReturnType<typeof ScrollSmoother.create>

// onMounted(() => {
//   if (vp.lg.value) {
//     smoother = ScrollSmoother.create({
//       // wrapper: 'body',
//       // content: '#landing-page',
//       smooth: 1.2,
//       effects: true,
//     })
//   }
// })

// onBeforeUnmount(() => {
//   if (vp.lg.value) {
//     smoother.kill()
//   }
// })
</script>

<template>
  <!-- <VueLenis root> -->
  <main id="landing-page">
    <HeroSection />
    <BenefitsSection />
    <!-- <HabitsSection /> -->
    <FeaturesSection />
    <UsageSection />
    <CustomizationSection />
    <StrengthsSection />
    <JoinSection />
    <FaqSection />
  </main>
  <!-- </VueLenis> -->
</template>
