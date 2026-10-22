<!-- File: src/views/CreateListing/components/wizard/CreateListingProgressBar.vue -->

<script setup lang="ts">
// import { icons } from '@/components/svgs'

const props = defineProps<{
  progressPercent: number
}>()
</script>

<template>
  <div class="progress">
    <div
      class="bar"
      :style="{ transform: `translateX(${props.progressPercent - 100}%)` }"
    />
  </div>
</template>
