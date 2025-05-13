<!-- File: src/views/Landing/_LandingPage.vue -->

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { initSectionScroller } from '@/utils/sectionScroller'

import HeroSection from '@/views/Landing/HeroSection.vue'
import BenefitsSection from './WhySection/BenefitsSection.vue'
import CustomizationSection from './WhySection/CustomizationSection.vue'
import HabitsSection from './WhySection/HabitsSection.vue'
import StrengthsSection from './StrengthsSection.vue'
import UsageSection from './UsageSection.vue'

let scroller: ReturnType<typeof initSectionScroller> | null = null

onMounted(() => {
  if (window.innerWidth > 1024) {
    scroller = initSectionScroller()
  }
})

onBeforeUnmount(() => {
  if (window.innerWidth > 1024) {
    scroller?.stop() // propre si App.vue est jamais démonté
  }
})
</script>

<template>
  <main id="landing-page">
    <HeroSection />
    <BenefitsSection />
    <HabitsSection />
    <CustomizationSection />
    <StrengthsSection />
    <UsageSection />
  </main>
</template>
