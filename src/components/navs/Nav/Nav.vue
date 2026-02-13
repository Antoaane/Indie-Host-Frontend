<!-- File: src/components/navs/Nav/Nav.vue -->

<script setup lang="ts">
import { useAuth } from '@clerk/vue'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import HostReservationOverlay from '@/components/navs/HostReservationOverlay.vue'
import NavHostVariant from '@/components/navs/Nav/NavHostVariant.vue'
import NavLandingVariant from '@/components/navs/Nav/NavLandingVariant.vue'
import NavPublicVariant from '@/components/navs/Nav/NavPublicVariant.vue'
import type { NavItem, NavVariant } from '@/components/navs/Nav/navTypes'
import { closeMobileMenu } from '@/components/navs/navUtils'
import { vp } from '@/utils/viewport'
import clerkToken from '@/utils/clerkToken'

const route = useRoute()
const router = useRouter()
const { getToken } = useAuth()

const navRoot = ref<HTMLElement | null>(null)
const reservationAnchor = ref<HTMLElement | null>(null)
const reservationOpen = ref(false)

const navVariant = computed<NavVariant>(() => {
  const variant = route.meta?.navVariant
  if (variant === 'landing' || variant === 'host' || variant === 'public') return variant
  return 'public'
})
const isNavHidden = computed(() => Boolean(route.meta?.hideNav))
const isNavVisible = computed(() => {
  if (isNavHidden.value) return false
  if (navVariant.value === 'landing') return true
  return vp.lg.value
})
const isHost = computed(() => navVariant.value === 'host')

function toggleReservation(event?: MouseEvent) {
  if (!reservationOpen.value) {
    const target = event?.currentTarget
    if (target instanceof HTMLElement) {
      reservationAnchor.value = target
    }
  }
  reservationOpen.value = !reservationOpen.value
}

function closeReservation() {
  reservationOpen.value = false
}

watch(isHost, (value) => {
  if (!value) closeReservation()
})

watch(vp.lg, (value) => {
  if (!value) closeReservation()
})

watch(
  () => route.fullPath,
  () => {
    closeReservation()
    closeMobileMenu()
  },
)

const resolveRouteLink = (name?: string) => {
  if (!name) return route.fullPath
  try {
    const resolved = router.resolve({ name })
    return resolved?.href || route.fullPath
  } catch {
    return route.fullPath
  }
}

const landingNavItems: NavItem[] = [
  { id: 'join-section', name: 'Essayer gratuitement', link: '#join-section', target: true, cta: true },
  { id: 'features-section', name: 'Fonctionnalités', link: '#features-section', target: true },
  { id: 'how-section', name: 'Comment ça marche ?', link: '#how-section', target: true },
  { id: 'strengths-section', name: 'Nos valeurs', link: '#strengths-section', target: true },
]

const hostNavItems = computed<NavItem[]>(() => [
  {
    id: 'add-reservation',
    name: 'Ajouter une réservation',
    link: resolveRouteLink('management'),
    cta: true,
    action: toggleReservation,
    ref: reservationAnchor,
    attrs: {
      'aria-expanded': reservationOpen.value,
      'aria-controls': 'host-reservation-overlay',
      'aria-haspopup': 'dialog',
    },
  },
  { id: 'listings', name: 'Mes annonces', link: resolveRouteLink('editor') },
  { id: 'reservations', name: 'Réservations', link: resolveRouteLink('management') },
  { id: 'messagery', name: 'Messagerie', link: resolveRouteLink('messaging') },
  { id: 'dashboard', name: 'Tableau de bord', link: resolveRouteLink('dashboard') },
])

const publicNavItems = computed<NavItem[]>(() => [
  { id: 'messagery', name: 'Messagerie', link: resolveRouteLink('messaging') },
  { id: 'reservations', name: 'Réservations', link: resolveRouteLink('management') },
  { id: 'become-host', name: 'Devenir hôte', link: route.fullPath, target: true, cta: true },
])

const navItems = computed<NavItem[]>(() => {
  if (navVariant.value === 'landing') return landingNavItems
  if (navVariant.value === 'host') return hostNavItems.value
  return publicNavItems.value
})

const navVariantComponentMap: Record<NavVariant, Component> = {
  landing: NavLandingVariant,
  host: NavHostVariant,
  public: NavPublicVariant,
}

const activeNavComponent = computed(() => navVariantComponentMap[navVariant.value])

function animateNavIn() {
  const navElement = navRoot.value?.querySelector<HTMLElement>('.navbar')
  if (!navElement) return

  navElement.style.setProperty('transition', 'none')
  navElement.style.setProperty('opacity', '0')
  navElement.style.setProperty('transform', 'translateY(-100px)')

  window.setTimeout(() => {
    navElement.style.setProperty('transition', 'all 1s cubic-bezier(0.75, 0, 0.25, 1)')
    navElement.style.removeProperty('opacity')
    navElement.style.removeProperty('transform')
  }, 650)
}

watch(isNavVisible, (visible) => {
  if (!visible) {
    closeReservation()
    closeMobileMenu()
    return
  }
  nextTick(() => animateNavIn())
})

onMounted(async () => {
  if (isNavVisible.value) animateNavIn()

  clerkToken.value = await getToken.value()
  console.log('✅[clerkToken] fetched new token :', clerkToken.value)
})
</script>

<template>
  <header
    v-if="isNavVisible"
    ref="navRoot"
    class="layout-header"
  >
    <component
      :is="activeNavComponent"
      :items="navItems"
    />

    <HostReservationOverlay
      v-if="isHost"
      :open="reservationOpen"
      :anchor="reservationAnchor"
      @close="closeReservation"
      @submit="closeReservation"
    />
  </header>
</template>
