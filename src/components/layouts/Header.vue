<!-- File: src/components/layouts/Header.vue -->

<script setup lang="ts">
// DEPS
import { onMounted, computed, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@clerk/vue'
// COMPONENTS
import NavListing from '@/components/navs/NavListing/NavListing.vue'
import Nav from '@/components/navs/Nav/Nav.vue'
import BottomNav from '@/components/navs/BottomNav/BottomNav.vue'
import HostReservationOverlay from '@/components/navs/HostReservationOverlay.vue'
// UTILS
import { vp } from '@/utils/viewport'
import clerkToken from '@/utils/clerkToken'
// import NavDashboard from '@/components/navs/nav/NavDashboard.vue'

const { getToken } = useAuth()

// const isLanding = ref<boolean>(true)

const route = useRoute()
const router = useRouter()

type NavItem = {
  id: string
  name: string
  link: string
  target?: boolean
  cta?: boolean
  action?: (event?: MouseEvent) => void
  attrs?: Record<string, string | number | boolean>
  ref?: Ref<HTMLElement | null>
}

const navVariant = computed(() => (route.meta?.navVariant as string | undefined) ?? 'public')
const isLanding = computed(() => navVariant.value === 'landing')
const isHost = computed(() => navVariant.value === 'host')

const reservationAnchor = ref<HTMLElement | null>(null)
const reservationOpen = ref(false)

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
  if (!value) reservationOpen.value = false
})

watch(vp.lg, (value) => {
  if (!value) reservationOpen.value = false
})

watch(
  () => route.fullPath,
  () => {
    if (reservationOpen.value) reservationOpen.value = false
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
  { id: 'features-section', name: 'Fonctionnalit\u00e9s', link: '#features-section', target: true },
  { id: 'how-section', name: 'Comment \u00e7a marche ?', link: '#how-section', target: true },
  { id: 'strengths-section', name: 'Nos valeurs', link: '#strengths-section', target: true },
]

const hostNavItems = computed<NavItem[]>(() => [
  {
    id: 'add-reservation',
    name: 'Ajouter une r\u00e9servation',
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
  { id: 'reservations', name: 'R\u00e9servations', link: resolveRouteLink('management') },
  { id: 'messagery', name: 'Messagerie', link: resolveRouteLink('messaging') },
  { id: 'dashboard', name: 'Tableau de bord', link: resolveRouteLink('dashboard') },
])

const publicNavItems = computed<NavItem[]>(() => [
  { id: 'messagery', name: 'Messagerie', link: resolveRouteLink('messaging') },
  { id: 'reservations', name: 'R\u00e9servations', link: resolveRouteLink('management') },
  { id: 'become-host', name: 'Devenir h\u00f4te', link: route.fullPath, target: true, cta: true },
])

const navItems = computed<NavItem[]>(() => {
  if (navVariant.value === 'landing') return landingNavItems
  if (navVariant.value === 'host') return hostNavItems.value
  return publicNavItems.value
})
// onMounted(() => {
//   isLanding.value = window.location.pathname === '/'
//   console.log('isLanding', isLanding.value)
// })

onMounted(async () => {
  const nav = document.querySelector<HTMLElement>('[class^="navbar-"]')

  nav?.style.setProperty('transition', 'none')
  nav?.style.setProperty('opacity', '0')
  nav?.style.setProperty('transform', 'translateY(-100px)')

  setTimeout(() => {
    nav?.style.setProperty('transition', 'all 1s cubic-bezier(0.75, 0, 0.25, 1)')
    nav?.style.removeProperty('opacity')
    nav?.style.removeProperty('transform')
  }, 650)

  clerkToken.value = await getToken.value()
  console.log('✅[clerkToken] fetched new token :', clerkToken.value)
})
</script>

<template>
  <header class="layout-header">
    <Nav
      v-if="isLanding"
      :items="navItems"
      :full="false"
    />

    <Nav
      v-if="vp.lg.value && !isLanding"
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
