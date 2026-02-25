<!-- File: src/views/Landing/components/UsageSection/UsageSection.vue -->

<script setup lang="ts">
// DEPS
import StepSection from '@/views/Landing/components/UsageSection/components/StepSection/StepSection.vue'

import type { UsageStep } from '@/views/Landing/types/content'

const props = defineProps<{
  steps: UsageStep[]
}>()
</script>

<template>
  <div id="usage-section">
    <StepSection
      v-for="(step, index) in props.steps"
      :key="step.id"
      :step="index + 1"
      :title="step.title"
      :description="step.description"
      :video1="step.videos?.[0]?.webm"
      :video2="step.videos?.[0]?.mp4"
      :illustration1="step.images?.[0]?.webp || ''"
      :illustration2="step.images?.[0]?.png || ''"
      :illustration-title="step.images?.[0]?.alt || ''"
      :illustration-alt="step.images?.[0]?.alt || ''"
    />
  </div>
</template>

<style lang="scss">
#usage-section {
  max-width: 100vw;
  padding: 0 !important;
}
</style>
