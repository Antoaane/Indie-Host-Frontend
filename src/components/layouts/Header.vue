<!-- File: src/components/layouts/Header.vue -->

<script setup lang="ts">
// DEPS
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
// COMPONENTS
import NavListing from '@/components/navs/NavListing/NavListing.vue'
import Nav from '@/components/navs/Nav/Nav.vue'
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
    <Nav
      v-if="isLanding"
      :items="[
        { id: 'join-section', name: 'Essayer gratuitement', link: '#join-section', target: true, cta: true },
        { id: 'features-section', name: 'Fonctionnalités', link: '#features-section', target: true },
        { id: 'how-section', name: 'Comment ça marche ?', link: '#how-section', target: true },
        { id: 'strengths-section', name: 'Nos valeurs', link: '#strengths-section', target: true },
      ]"
      :full="false"
    />

    <Nav
      v-else
      :items="[
        { id: 'messagery', name: 'Messagerie', link: '', target: true },
        { id: 'reservations', name: 'Réservations', link: '', target: true },
        { id: 'become-host', name: 'Devenir hôte', link: '', target: true, cta: true },
      ]"
    />
  </header>
</template>
