<!-- File: src/views/CreateListing/components/wizard/CreateListingProgressBar.vue -->

<script setup lang="ts">
import { icons } from '@/components/svgs'

const props = defineProps<{
  progressPercent: number
}>()
</script>

<template>
  <component
    :is="icons.logoFull.adapt"
    title="IndieHost"
    desc="Logo de IndieHost, plateforme de gestion de locations saisonnières"
    role="img"
  />
  <div class="progress">
    <div
      class="bar"
      :style="{ width: `${props.progressPercent}%` }"
    />
  </div>
</template>
