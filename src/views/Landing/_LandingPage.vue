<!-- File: src/views/Landing/_LandingPage.vue -->

<script setup lang="ts">
import HeroSection from '@/views/Landing/HeroSection.vue';
import BenefitsSection from './WhySection/BenefitsSection.vue';
import CustomizationSection from './WhySection/CustomizationSection.vue';
import HabitsSection from './WhySection/HabitsSection.vue';
</script>

<template>
    <main id="landing-page">
        <HeroSection />
        <BenefitsSection />
        <HabitsSection />
        <CustomizationSection />
    </main>
</template>