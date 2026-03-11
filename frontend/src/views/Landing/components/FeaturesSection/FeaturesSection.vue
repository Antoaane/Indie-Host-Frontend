<!-- File: src/views/Landing/components/FeaturesSection/FeaturesSection.vue -->

<script setup lang="ts">
// CONTENT
import type { FeatureItem } from '@/views/Landing/types/content'
import Feature from './components/Feature/Feature.vue'

const props = defineProps<{
  items: FeatureItem[]
}>()
</script>

<template>
  <section id="features-section">
    <Feature
      v-for="(feature, i) in props.items"
      :feature="feature"
      :index="i"
      :is-last="i === props.items.length - 1"
    />
  </section>
</template>

<style lang="scss">
@use '@/views/Landing/components/FeaturesSection/features-section.scss';
</style>
