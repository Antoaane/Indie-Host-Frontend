<!-- File: src/views/Editor/components/EditorListings/components/EditorListingsCreateCard.vue -->

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

const props = defineProps<{
  to: RouteLocationRaw
  title: string
  activeUsage: string
  remainingDisplay: string
  isLimitReached: boolean
}>()
</script>

<template>
  <div class="new-card">
    <RouterLink :to="props.to">
      <div class="content">
        <span>{{ props.title }}</span>
        <small class="usage">{{ props.activeUsage }}</small>
        <small
          class="remaining"
          :class="{ 'is-limit-reached': props.isLimitReached }"
        >
          {{ props.remainingDisplay }}
        </small>
      </div>
    </RouterLink>
  </div>
</template>
