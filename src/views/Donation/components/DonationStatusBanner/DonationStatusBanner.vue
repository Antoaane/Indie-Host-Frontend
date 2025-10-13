<!-- File: src/views/Donation/components/DonationStatusBanner/DonationStatusBanner.vue -->

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  status: string
  title: string
  body: string
  severity?: 'positive' | 'negative' | 'info' | 'neutral' | string
}>()

const severityClass = computed(() => {
  const severity = props.severity ?? ''

  if (severity === 'positive' || severity === 'success') {
    return 'donation-status--positive'
  }

  if (severity === 'negative' || severity === 'error' || severity === 'danger') {
    return 'donation-status--negative'
  }

  if (severity === 'info' || severity === 'warning') {
    return 'donation-status--info'
  }

  if (severity === 'neutral') {
    return 'donation-status--neutral'
  }

  return undefined
})

const statusClass = computed(() => {
  if (!props.status) {
    return undefined
  }

  return `donation-status--${props.status}`
})
</script>

<template>
  <div
    class="donation-status"
    :class="[severityClass, statusClass]"
    role="status"
    aria-live="polite"
  >
    <p
      class="donation-status__title"
      v-html="title"
    />
    <p
      class="donation-status__body"
      v-html="body"
    />
  </div>
</template>

<style lang="scss" scoped src="@/views/Donation/components/DonationStatusBanner/DonationStatusBanner.scss"></style>
