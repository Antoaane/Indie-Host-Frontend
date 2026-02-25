<!-- File: src/views/CreateListing/components/wizard/CreateListingProgressBar.vue -->

<script setup lang="ts">
const props = defineProps<{
  progressPercent: number
}>()
</script>

<template>
  <div class="progress">
    <div
      class="bar"
      :style="{ width: `${props.progressPercent}%` }"
    />
  </div>
</template>
