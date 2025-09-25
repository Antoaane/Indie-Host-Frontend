<!-- File: src/components/layouts/Header.vue -->

<script setup lang="ts">
// DEPS
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
// COMPONENTS
import NavListing from '@/components/navs/NavListing/NavListing.vue'
import NavLanding from '@/components/navs/NavLanding/NavLanding.vue'
// import NavDashboard from '@/components/navs/nav/NavDashboard.vue'

// const isLanding = ref<boolean>(true)

const route = useRoute()

const isLanding = computed(() => route.path === '/')
// onMounted(() => {
//   isLanding.value = window.location.pathname === '/'
//   console.log('isLanding', isLanding.value)
// })
</script>

<template>
  <header>
    <NavLanding v-if="isLanding" />
    <NavListing v-else />
  </header>
</template>
