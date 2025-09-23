<!-- File: src/views/Crowdfunding/components/DonationStatusBanner/DonationStatusBanner.vue -->
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  status: 'success' | 'cancel'
  title: string
  body: string
}>()

const modifierClass = computed(() => {
  return props.status === 'success' ? 'donation-status--success' : 'donation-status--cancel'
})
</script>

<template>
  <div
    class="donation-status"
    :class="modifierClass"
    role="status"
    aria-live="polite"
  >
    <p class="donation-status__title">{{ title }}</p>
    <p class="donation-status__body">{{ body }}</p>
  </div>
</template>

<style lang="scss" scoped src="@/views/Crowdfunding/components/DonationStatusBanner/DonationStatusBanner.scss"></style>
