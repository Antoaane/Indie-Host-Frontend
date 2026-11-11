<!-- File: src/views/Revenues/RevenuesRoute.vue -->

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { fetchMyStripeConnectOverview, type StripeConnectOverview } from '@/domain/api/stripeSubscriptions'
import { openStripeDashboard } from '@/domain/payments/stripeDashboard'
import Revenues from '@/views/Revenues/_Revenues.vue'

const overview = ref<StripeConnectOverview | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
const isOpeningDashboard = ref(false)

async function load() {
  isLoading.value = true
  error.value = null

  try {
    overview.value = await fetchMyStripeConnectOverview()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Impossible de charger vos revenus pour le moment.'
  } finally {
    isLoading.value = false
  }
}

async function handleOpenDashboard() {
  if (isOpeningDashboard.value) return
  isOpeningDashboard.value = true
  try {
    await openStripeDashboard(overview.value?.account.id)
  } finally {
    isOpeningDashboard.value = false
  }
}

onMounted(load)
</script>

<template>
  <Revenues
    :overview="overview"
    :is-loading="isLoading"
    :error="error"
    :is-opening-dashboard="isOpeningDashboard"
    @open-dashboard="handleOpenDashboard"
    @retry="load"
  />
</template>
