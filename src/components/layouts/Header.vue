<!-- File: src/components/layouts/Header.vue -->

<script setup lang="ts">
// DEPS
import { ref, onMounted } from 'vue'
// COMPONENTS
import NavLanding from '@/components/navs/NavLanding/NavLanding.vue'
import NavListing from '@/components/navs/NavListing/NavListing.vue'
// import NavDashboard from '@/components/navs/nav/NavDashboard.vue'

const isLanding = ref<boolean>(true)

onMounted(() => {
  isLanding.value = window.location.pathname === '/'
})
</script>

<template>
  <header>
    <NavLanding v-if="isLanding" />
    <NavListing v-else />
  </header>
</template>
