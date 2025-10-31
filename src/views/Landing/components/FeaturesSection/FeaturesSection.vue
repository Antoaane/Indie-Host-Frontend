<!-- File: src/views/Landing/components/FeaturesSection/FeaturesSection.vue -->

<script setup lang="ts">
// CONTENT
import type { ItemSection } from '@/content/types'
import rawContent from '@/content/fr/Landing/features-section.json'
import Feature from './components/Feature/Feature.vue'

const section = rawContent as ItemSection
</script>

<template>
  <section id="features-section">
    <Feature
      v-for="(feature, i) in section.items['features'].meta?.data"
      :feature="feature"
      :format="feature.format || 'hzt'"
      :index="i"
    />
  </section>
</template>

<style lang="scss">
@use '@/views/Landing/components/FeaturesSection/features-section.scss';
</style>
