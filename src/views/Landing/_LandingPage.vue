<!-- File: src/views/Landing/_LandingPage.vue -->

<script setup lang="ts">
// DEPS
import { VueLenis } from 'lenis/vue'

// ASSETS
import HeroSection from '@/views/Landing/HeroSection.vue'
import BenefitsSection from '@/views/Landing/BenefitsSection/BenefitsSection.vue'
import CustomizationSection from '@/views/Landing/CustomizationSection/CustomizationSection.vue'
// import HabitsSection from '@/views/Landing/HabitsSection.vue'
import HabitsSection from '@/views/Landing/HabitsSection/HabitsSection.vue'
import StrengthsSection from '@/views/Landing/StrengthsSection.vue'
import UsageSection from '@/views/Landing/UsageSection/UsageSection.vue'
import JoinSection from '@/views/Landing/JoinSection.vue'
import FaqSection from '@/views/Landing/FaqSection.vue'
</script>

<template>
  <VueLenis root>
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
  </VueLenis>
</template>
