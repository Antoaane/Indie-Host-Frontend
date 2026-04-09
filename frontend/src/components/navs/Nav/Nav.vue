<!-- File: src/components/navs/Nav/Nav.vue -->

<script setup lang="ts">
import { useAuth, useClerk, useUser } from '@clerk/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CalendarClock, LayoutGrid, MessageSquareMore, MoreHorizontal, Plus } from 'lucide-vue-next'

import HostReservationOverlay from '@/components/navs/HostReservationOverlay.vue'
import BackOfficeDockNav from '@/components/navs/Nav/BackOfficeDockNav.vue'
import HostProfileDialog from '@/components/navs/Nav/HostProfileDialog.vue'
import NavHostVariant from '@/components/navs/Nav/NavHostVariant.vue'
import NavLandingVariant from '@/components/navs/Nav/NavLandingVariant.vue'
import NavPublicVariant from '@/components/navs/Nav/NavPublicVariant.vue'
import type { NavItem, NavVariant } from '@/components/navs/Nav/navTypes'
import { closeMobileMenu, isMobileMenuOpen, isNavForcedHidden } from '@/components/navs/navUtils'
import { createMyStripeConnectDashboardLink, fetchMyStripeSubscriptionState } from '@/domain/api/stripeSubscriptions'
import { isManagedListingHostname } from '@/domain/listings/publicDomain'
import { readActiveUserId } from '@/router/backOfficeUser'
import { vp } from '@/utils/viewport'
import clerkToken from '@/utils/clerkToken'

const route = useRoute()
const router = useRouter()
const { getToken, signOut } = useAuth()
const { isSignedIn } = useUser()
const clerk = useClerk()

const navRoot = ref<HTMLElement | null>(null)
const reservationAnchor = ref<HTMLElement | null>(null)
const reservationOpen = ref(false)
const isNavHiddenByScroll = ref(false)
const canOpenStripeConnectDashboard = ref(false)
const stripeConnectAccountId = ref<string | null>(null)
const isOpeningStripeConnectDashboard = ref(false)
const stripeConnectAvailabilityRequestId = ref(0)
const dockOptionsOpen = ref(false)
const myProfileDialogOpen = ref(false)

let lastScrollY = 0
const SCROLL_THRESHOLD = 80
const SCROLL_HIDE_DELTA = 10
const SCROLL_SHOW_DELTA = 8
/** Au-delà de ce delta (scroll rapide vers le haut), on cache la nav (ex. remontée depuis le footer vers l’intro). */
const FAST_SCROLL_UP_HIDE_DELTA = 45

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

  if (delta <= -FAST_SCROLL_UP_HIDE_DELTA) {
    isNavHiddenByScroll.value = true
  } else if (delta >= SCROLL_HIDE_DELTA) {
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

type BackOfficeRouteName = 'editor' | 'create-listing' | 'management' | 'messaging'
type BackOfficeUserRouteName = 'editor-user' | 'create-listing-user' | 'management-user' | 'messaging-user'

const BACK_OFFICE_USER_ROUTE_BY_ENTRY_ROUTE: Record<BackOfficeRouteName, BackOfficeUserRouteName> = {
  editor: 'editor-user',
  'create-listing': 'create-listing-user',
  management: 'management-user',
  messaging: 'messaging-user',
}

type BackOfficeDockItem = {
  id: string
  label: string
  link?: string
  icon: Component
  isActive?: boolean
  isPrimary?: boolean
  action?: (event?: MouseEvent) => void | Promise<void>
  attrs?: Record<string, string | number | boolean>
}

type BackOfficeDockOptionsItem = {
  id: string
  label: string
  link?: string
  action?: (event?: MouseEvent) => void | Promise<void>
  isDanger?: boolean
  disabled?: boolean
  attrs?: Record<string, string | number | boolean>
}

const currentRouteName = computed(() => {
  const value = route.name
  if (typeof value === 'string') return value
  return ''
})
const activeBackOfficeUserId = computed(() => readActiveUserId(route.params.userId))

function toggleReservation(event?: MouseEvent) {
  closeDockOptions()

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

function toggleDockOptions(event?: MouseEvent) {
  event?.preventDefault()
  closeReservation()
  dockOptionsOpen.value = !dockOptionsOpen.value
}

function closeDockOptions() {
  dockOptionsOpen.value = false
}

function resetStripeConnectDashboardAccess() {
  canOpenStripeConnectDashboard.value = false
  stripeConnectAccountId.value = null
}

async function refreshStripeConnectDashboardAvailability() {
  const requestId = stripeConnectAvailabilityRequestId.value + 1
  stripeConnectAvailabilityRequestId.value = requestId

  if (!isHost.value || !isSignedIn.value) {
    resetStripeConnectDashboardAccess()
    return
  }

  try {
    const token = await getToken.value()
    if (!token) throw new Error('Session utilisateur absente.')

    clerkToken.value = token
    const state = await fetchMyStripeSubscriptionState()
    if (requestId !== stripeConnectAvailabilityRequestId.value) return

    const accountId = state.connect?.accountId ?? null
    const onboardingCompleted = Boolean(state.publicationReadiness?.connectOnboardingCompleted || state.connect?.onboardingStatus === 'completed')

    stripeConnectAccountId.value = accountId
    canOpenStripeConnectDashboard.value = Boolean(accountId) && onboardingCompleted
  } catch {
    if (requestId !== stripeConnectAvailabilityRequestId.value) return
    resetStripeConnectDashboardAccess()
  }
}

async function handleOpenStripeConnectDashboard(_event?: MouseEvent) {
  if (!canOpenStripeConnectDashboard.value || isOpeningStripeConnectDashboard.value) return

  isOpeningStripeConnectDashboard.value = true

  try {
    const token = await getToken.value()
    if (!token) throw new Error('Session utilisateur absente.')

    clerkToken.value = token
    const dashboard = await createMyStripeConnectDashboardLink({
      accountId: stripeConnectAccountId.value ?? undefined,
    })

    const opened = window.open(dashboard.url, '_blank', 'noopener,noreferrer')
    if (!opened) {
      window.location.assign(dashboard.url)
    }
  } catch (error) {
    console.warn("[Nav] impossible d'ouvrir les revenus Stripe Connect", { error })
  } finally {
    isOpeningStripeConnectDashboard.value = false
  }
}

function handleOpenMyAccount() {
  clerk.value?.openUserProfile()
}

function handleOpenMyProfile() {
  myProfileDialogOpen.value = true
}

function closeMyProfileDialog() {
  myProfileDialogOpen.value = false
}

async function handleSignOut() {
  try {
    await signOut.value({ redirectUrl: '/' })
  } catch (error) {
    console.warn('[Nav] impossible de se déconnecter', { error })
  }
}

watch(isHost, (value) => {
  if (!value) {
    closeReservation()
    closeDockOptions()
    resetStripeConnectDashboardAccess()
    return
  }
  void refreshStripeConnectDashboardAvailability()
})

watch(vp.lg, (value) => {
  if (!value) closeReservation()
  closeDockOptions()
})

watch(isBackOfficeDockMode, (value) => {
  if (!value) closeDockOptions()
})

watch(
  () => route.fullPath,
  () => {
    closeReservation()
    closeDockOptions()
    closeMyProfileDialog()
    closeMobileMenu()
    isNavHiddenByScroll.value = false
    lastScrollY = window.scrollY
    void refreshStripeConnectDashboardAvailability()
  },
)

watch(
  () => isSignedIn.value,
  () => {
    void refreshStripeConnectDashboardAvailability()
  },
  { immediate: true },
)

const resolveRouteLink = (
  name?: string,
  options?: {
    params?: Record<string, string>
    query?: Record<string, string>
  },
) => {
  if (!name) return route.fullPath
  try {
    const resolved = router.resolve({
      name,
      ...(options?.params ? { params: options.params } : {}),
      ...(options?.query ? { query: options.query } : {}),
    })
    return resolved?.href || route.fullPath
  } catch {
    return route.fullPath
  }
}

function resolveBackOfficeRouteLink(name: BackOfficeRouteName, fallbackPath: string) {
  if (isSignedIn.value) {
    const userId = activeBackOfficeUserId.value
    if (userId) {
      return resolveRouteLink(BACK_OFFICE_USER_ROUTE_BY_ENTRY_ROUTE[name], { params: { userId } })
    }
    return resolveRouteLink(name)
  }
  return resolveRouteLink('sign-in', { query: { redirect_url: fallbackPath } })
}

function scrollToIntroOnDesktop() {
  if (vp.lg.value) {
    document.querySelector('#intro-section')?.scrollIntoView({ behavior: 'smooth' })
    return
  }

  void router.push('/pricing')
}

const landingNavItems = computed<NavItem[]>(() => {
  const trialOrManagementItem: NavItem = isSignedIn.value
    ? {
        id: 'my-space',
        name: 'Mon espace',
        link: '/dashboard/management',
        cta: true,
      }
    : {
        id: 'trial-intro',
        name: 'Essayer gratuitement',
        link: '/pricing',
        cta: true,
        action: scrollToIntroOnDesktop,
      }

  return [
    { id: 'features-section', name: 'Fonctionnalités', link: '#features-section', target: true },
    { id: 'how-section', name: 'Comment ça marche ?', link: '#how-section', target: true },
    { id: 'strengths-section', name: 'Nos valeurs', link: '#strengths-section', target: true },
    { id: 'pricing-section', name: 'Tarifs', link: '#pricing-section', target: true },
    trialOrManagementItem,
  ]
})

const hostNavItems = computed<NavItem[]>(() => {
  const items: NavItem[] = [
    {
      id: 'add-reservation',
      name: 'Ajouter une réservation',
      link: resolveBackOfficeRouteLink('management', '/dashboard/management'),
      cta: true,
      action: toggleReservation,
      ref: reservationAnchor,
      attrs: {
        'aria-expanded': reservationOpen.value,
        'aria-controls': 'host-reservation-overlay',
        'aria-haspopup': 'dialog',
      },
    },
    { id: 'listings', name: 'Mes annonces', link: resolveBackOfficeRouteLink('editor', '/dashboard/editor') },
    { id: 'reservations', name: 'Réservations', link: resolveBackOfficeRouteLink('management', '/dashboard/management') },
    { id: 'messagery', name: 'Messagerie', link: resolveBackOfficeRouteLink('messaging', '/dashboard/messages') },
  ]

  if (canOpenStripeConnectDashboard.value) {
    items.push({
      id: 'revenues',
      name: 'Mes revenus',
      link: resolveBackOfficeRouteLink('management', '/dashboard/management'),
      action: handleOpenStripeConnectDashboard,
      attrs: {
        disabled: isOpeningStripeConnectDashboard.value,
      },
    })
  }

  return items
})

const publicNavItems = computed<NavItem[]>(() => [
  { id: 'messagery', name: 'Messagerie', link: resolveBackOfficeRouteLink('messaging', '/dashboard/messages') },
  { id: 'reservations', name: 'Réservations', link: resolveBackOfficeRouteLink('management', '/dashboard/management') },
  { id: 'become-host', name: 'Devenir hôte', link: '/pricing', cta: true },
])

const navItems = computed<NavItem[]>(() => {
  if (navVariant.value === 'landing') return landingNavItems.value
  if (navVariant.value === 'host') return hostNavItems.value
  return publicNavItems.value
})

const navVariantComponentMap: Record<NavVariant, Component> = {
  landing: NavLandingVariant,
  host: NavHostVariant,
  public: NavPublicVariant,
}

const activeNavComponent = computed(() => navVariantComponentMap[navVariant.value])

const backOfficeDockOptionsItems = computed<BackOfficeDockOptionsItem[]>(() => [
  {
    id: 'dock-options-stripe-dashboard',
    label: 'Dashboard Stripe',
    action: handleOpenStripeConnectDashboard,
    disabled: !canOpenStripeConnectDashboard.value || isOpeningStripeConnectDashboard.value,
  },
  {
    id: 'dock-options-my-account',
    label: 'Mes informations',
    action: handleOpenMyAccount,
  },
  {
    id: 'dock-options-my-profile',
    label: 'Mon profil',
    action: handleOpenMyProfile,
  },
  {
    id: 'dock-options-sign-out',
    label: 'Se déconnecter',
    action: handleSignOut,
    isDanger: true,
  },
])

const backOfficeDockItems = computed(() => {
  const routeName = currentRouteName.value
  const isEditorRoute = routeName === 'editor' || routeName === 'editor-user'
  const isManagementRoute = routeName === 'management' || routeName === 'management-user'
  const isMessagingRoute = routeName === 'messaging' || routeName === 'messaging-user'

  return [
    {
      id: 'dock-listings',
      label: 'Annonces',
      icon: LayoutGrid,
      link: resolveBackOfficeRouteLink('editor', '/dashboard/editor'),
      isActive: isEditorRoute,
    },
    {
      id: 'dock-management',
      label: 'Réservations',
      icon: CalendarClock,
      link: resolveBackOfficeRouteLink('management', '/dashboard/management'),
      isActive: isManagementRoute,
    },
    {
      id: 'dock-add-reservation',
      label: 'Ajouter une<br>réservation',
      icon: Plus,
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
      link: resolveBackOfficeRouteLink('messaging', '/dashboard/messages'),
      isActive: isMessagingRoute,
    },
    {
      id: 'dock-options',
      label: 'Options',
      icon: MoreHorizontal,
      action: toggleDockOptions,
      isActive: dockOptionsOpen.value,
      attrs: {
        'aria-expanded': dockOptionsOpen.value,
        'aria-controls': 'back-office-dock-options-menu',
        'aria-haspopup': 'menu',
      },
    },
  ] satisfies BackOfficeDockItem[]
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
    closeDockOptions()
    closeMobileMenu()
    return
  }
  nextTick(() => animateNavIn())
})

onMounted(async () => {
  if (isNavVisible.value) animateNavIn()
  lastScrollY = window.scrollY
  window.addEventListener('scroll', onScroll, { passive: true })

  try {
    clerkToken.value = await getToken.value()
    console.log('✅[clerkToken] fetched new token')
  } catch {
    clerkToken.value = null
  }

  void refreshStripeConnectDashboardAvailability()
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
      :options-open="dockOptionsOpen"
      :options-items="backOfficeDockOptionsItems"
      @request-close-options="closeDockOptions"
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

    <HostProfileDialog
      :open="myProfileDialogOpen"
      @close="closeMyProfileDialog"
    />
  </header>
</template>
