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

const isLanding = computed(() => route.path === '/' || route.path === '/donation')
// onMounted(() => {
//   isLanding.value = window.location.pathname === '/'
//   console.log('isLanding', isLanding.value)
// })

onMounted(() => {
  const nav = document.querySelector<HTMLElement>('[class^="navbar-"]')

  nav?.style.setProperty('transition', 'none')
  nav?.style.setProperty('opacity', '0')
  nav?.style.setProperty('transform', 'translateY(-100px)')

  setTimeout(() => {
    nav?.style.setProperty('transition', 'all 1s cubic-bezier(0.75, 0, 0.25, 1)')
    nav?.style.removeProperty('opacity')
    nav?.style.removeProperty('transform')
  }, 650)
})
</script>

<template>
  <header>
    <NavLanding v-if="isLanding" />
    <NavListing v-else />
  </header>
</template>
