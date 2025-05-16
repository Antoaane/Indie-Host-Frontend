<!-- File: src/views/Landing/_LandingPage.vue -->

<script setup lang="ts">
// DEPS
import { onMounted, onBeforeUnmount } from 'vue'
import { initSectionScroller } from '@/utils/sectionScroller'
import { VueLenis, useLenis } from 'lenis/vue'
import { watch } from 'vue'
// ASSETS
import HeroSection from '@/views/Landing/HeroSection.vue'
import BenefitsSection from './WhySection/BenefitsSection.vue'
import CustomizationSection from './WhySection/CustomizationSection.vue'
import HabitsSection from './WhySection/HabitsSection.vue'
import StrengthsSection from './StrengthsSection.vue'
import UsageSection from './UsageSection.vue'
import EmailSection from './JoinSection.vue'

const lenis = useLenis(({ scroll }) => {
  // called every scroll
})

watch(lenis, (lenis) => {
  // lenis instance
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
    <EmailSection />
  </main>
</template>
