<!-- File: src/components/navs/Nav/Nav.vue -->

<script setup lang="ts">
import { useAuth } from '@clerk/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CalendarClock, Globe, LayoutGrid, MessageSquareMore, PlusSquare } from 'lucide-vue-next'

import HostReservationOverlay from '@/components/navs/HostReservationOverlay.vue'
import BackOfficeDockNav from '@/components/navs/Nav/BackOfficeDockNav.vue'
import NavHostVariant from '@/components/navs/Nav/NavHostVariant.vue'
import NavLandingVariant from '@/components/navs/Nav/NavLandingVariant.vue'
import NavPublicVariant from '@/components/navs/Nav/NavPublicVariant.vue'
import type { NavItem, NavVariant } from '@/components/navs/Nav/navTypes'
import { closeMobileMenu, isMobileMenuOpen, isNavForcedHidden } from '@/components/navs/navUtils'
import { isManagedListingHostname } from '@/domain/listings/publicDomain'
import { vp } from '@/utils/viewport'
import clerkToken from '@/utils/clerkToken'

const route = useRoute()
const router = useRouter()
const { getToken } = useAuth()

const navRoot = ref<HTMLElement | null>(null)
const reservationAnchor = ref<HTMLElement | null>(null)
const reservationOpen = ref(false)
const isNavHiddenByScroll = ref(false)

let lastScrollY = 0
const SCROLL_THRESHOLD = 80
const SCROLL_HIDE_DELTA = 10
const SCROLL_SHOW_DELTA = 8

function onScroll() {
  const currentY = window.scrollY
  const delta = currentY - lastScrollY

  if (currentY <= SCROLL_THRESHOLD) {
    isNavHiddenByScroll.value = false
    lastScrollY = currentY
    return
  }

  if (isMobileMenuOpen.value) {
    isNavHiddenByScroll.value = false
    lastScrollY = currentY
    return
  }

  if (delta >= SCROLL_HIDE_DELTA) {
    isNavHiddenByScroll.value = true
  } else if (delta <= -SCROLL_SHOW_DELTA) {
    isNavHiddenByScroll.value = false
  }

  lastScrollY = currentY
}

const navVariant = computed<NavVariant>(() => {
  const variant = route.meta?.navVariant
  if (variant === 'landing' || variant === 'host' || variant === 'public') return variant
  return 'public'
})
const isPublicListingHost = computed(() => typeof window !== 'undefined' && isManagedListingHostname(window.location.hostname))
const isNavHidden = computed(() => Boolean(route.meta?.hideNav) || isPublicListingHost.value)
const isNavVisible = computed(() => !isNavHidden.value)
const isNavActuallyHidden = computed(() => isNavForcedHidden.value || isNavHiddenByScroll.value)
const isHost = computed(() => navVariant.value === 'host')
const isBackOfficeDockMode = computed(() => isHost.value && !vp.lg.value)

const currentRouteName = computed(() => {
  const value = route.name
  if (typeof value === 'string') return value
  return ''
})

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
    isNavHiddenByScroll.value = false
    lastScrollY = window.scrollY
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

function scrollToIntroOnDesktop() {
  if (vp.lg.value) {
    document.querySelector('#intro-section')?.scrollIntoView({ behavior: 'smooth' })
    return
  }

  void router.push('/pricing')
}

const landingNavItems: NavItem[] = [
  { id: 'pricing', name: 'Essayer gratuitement', link: '/pricing', cta: true, action: scrollToIntroOnDesktop },
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
  { id: 'domains', name: 'Domaines', link: resolveRouteLink('domains') },
  { id: 'messagery', name: 'Messagerie', link: resolveRouteLink('messaging') },
])

const publicNavItems = computed<NavItem[]>(() => [
  { id: 'messagery', name: 'Messagerie', link: resolveRouteLink('messaging') },
  { id: 'reservations', name: 'Réservations', link: resolveRouteLink('management') },
  { id: 'become-host', name: 'Devenir hôte', link: '/pricing', cta: true },
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

const backOfficeDockItems = computed(() => {
  const routeName = currentRouteName.value
  const isEditorRoute = routeName === 'editor' || routeName === 'editor-user'
  const isCreateRoute = routeName === 'create-listing' || routeName === 'create-listing-user'
  const isManagementRoute = routeName === 'management' || routeName === 'management-user'
  const isDomainsRoute = routeName === 'domains' || routeName === 'domains-user'
  const isMessagingRoute = routeName === 'messaging' || routeName === 'messaging-user'

  return [
    {
      id: 'dock-listings',
      label: 'Annonces',
      icon: LayoutGrid,
      link: resolveRouteLink('editor'),
      isActive: isEditorRoute,
    },
    {
      id: 'dock-management',
      label: 'Réserv.',
      icon: CalendarClock,
      link: resolveRouteLink('management'),
      isActive: isManagementRoute,
    },
    {
      id: 'dock-domains',
      label: 'Domaines',
      icon: Globe,
      link: resolveRouteLink('domains'),
      isActive: isDomainsRoute,
    },
    {
      id: 'dock-add-reservation',
      label: 'Ajout résa',
      icon: PlusSquare,
      isPrimary: true,
      action: toggleReservation,
      attrs: {
        'aria-expanded': reservationOpen.value,
        'aria-controls': 'host-reservation-overlay',
        'aria-haspopup': 'dialog',
      },
    },
    {
      id: 'dock-messaging',
      label: 'Messages',
      icon: MessageSquareMore,
      link: resolveRouteLink('messaging'),
      isActive: isMessagingRoute,
    },
    {
      id: 'dock-create',
      label: 'Créer',
      icon: PlusSquare,
      link: resolveRouteLink('create-listing'),
      isActive: isCreateRoute,
    },
  ]
})

function animateNavIn() {
  const navElement = navRoot.value?.querySelector<HTMLElement>('.navbar, .back-office-dock-nav')
  if (!navElement) return
  if (document.documentElement.classList.contains('is-ios') && !vp.lg.value) return
  if (document.documentElement.classList.contains('ios-landing-lite')) return

  const isDock = navElement.classList.contains('back-office-dock-nav')

  navElement.style.setProperty('transition', 'none')
  navElement.style.setProperty('opacity', '0')
  navElement.style.setProperty('transform', isDock ? 'translateY(100px)' : 'translateY(-100px)')

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
  lastScrollY = window.scrollY
  window.addEventListener('scroll', onScroll, { passive: true })

  clerkToken.value = await getToken.value()
  console.log('✅[clerkToken] fetched new token :', clerkToken.value)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <header
    v-if="isNavVisible"
    ref="navRoot"
    class="layout-header"
    :class="{ 'is-backoffice-dock': isBackOfficeDockMode, 'is-nav-hidden': isNavActuallyHidden }"
  >
    <BackOfficeDockNav
      v-if="isBackOfficeDockMode"
      :items="backOfficeDockItems"
    />

    <component
      v-else
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
