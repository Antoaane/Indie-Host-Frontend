<!-- File: src/views/CreateListing/components/wizard/CreateListingStepsTabs.vue -->

<script setup lang="ts">
import type { CreateListingStepItem } from '@/views/CreateListing/wizard/createListing.types'

const props = defineProps<{
  items: CreateListingStepItem[]
}>()

const emit = defineEmits<{
  (e: 'select', index: number): void
}>()
</script>

<template>
  <div class="steps">
    <button
      v-for="item in props.items"
      :key="item.id"
      class="step"
      :class="{
        'is-active': item.isActive,
        'is-done': item.isDone,
      }"
      type="button"
      :disabled="item.isDisabled"
      @click="emit('select', item.index)"
    >
      <span>{{ item.index + 1 }}</span>
      <small>{{ item.label }}</small>
    </button>
  </div>
</template>
