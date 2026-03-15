// File: src/router/index.ts

import SignInView from '@/views/SignInView.vue'
import SignUpView from '@/views/SignUpView.vue'
import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'
import { isManagedListingHostname } from '@/domain/listings/publicDomain'
import { resolveRuntimeUserId } from '@/router/backOfficeUser'
const HomePage = () => {
  if (typeof window !== 'undefined' && isManagedListingHostname(window.location.hostname)) {
    return import('@/views/Listing/_Listing.vue')
  }
  return import('@/views/Landing/_LandingPage.vue')
}
const PricingView = () => import('@/views/PricingView.vue')
const Listing = () => import('@/views/Listing/_Listing.vue')
const ListingGuide = () => import('@/views/ListingGuide/_ListingGuide.vue')
const EditorRoute = () => import('@/views/Editor/EditorRoute.vue')
const CreateListingRoute = () => import('@/views/CreateListing/CreateListingRoute.vue')
const CreateListingPublicRoute = () => import('@/views/CreateListing/CreateListingPublicRoute.vue')
const MessagingRoute = () => import('@/views/Messaging/MessagingRoute.vue')
const ManagementRoute = () => import('@/views/Management/ManagementRoute.vue')
const DomainsRoute = () => import('@/views/Domains/DomainsRoute.vue')

type BackOfficeUserRouteName =
  | 'editor-user'
  | 'create-listing-user'
  | 'management-user'
  | 'domains-user'
  | 'messaging-user'

async function resolveLegacyBackOfficeRedirect(
  to: RouteLocationNormalized,
  targetName: BackOfficeUserRouteName,
) {
  const userId = await resolveRuntimeUserId({
    waitMs: 1500,
    pollIntervalMs: 75,
  })

  if (userId) {
    return {
      name: targetName,
      params: { userId },
      query: to.query,
    }
  }

  return {
    name: 'sign-in',
    query: { redirect_url: to.fullPath },
  }
}

async function resolveCreateListingEntryRedirect(to: RouteLocationNormalized) {
  const userId = await resolveRuntimeUserId({
    waitMs: 1500,
    pollIntervalMs: 75,
  })

  if (userId) {
    return {
      name: 'create-listing-user',
      params: { userId },
      query: to.query,
    }
  }

  return {
    name: 'create-listing-public',
    query: to.query,
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage,
      meta: { navVariant: 'landing' },
    },
    {
      path: '/sign-in/:step(.*)*',
      name: 'sign-in',
      component: SignInView,
      meta: { navVariant: 'public' },
    },
    {
      path: '/sign-up/:step(.*)*',
      name: 'sign-up',
      component: SignUpView,
      meta: { navVariant: 'public' },
    },
    {
      path: '/pricing',
      name: 'pricing',
      component: PricingView,
      meta: { navVariant: 'public' },
    },
    {
      path: '/listing/:id?',
      name: 'listing',
      component: Listing,
      meta: { hideNav: true },
    },
    {
      path: '/listing/guide/:id',
      name: 'listing-guide',
      component: ListingGuide,
      meta: { hideNav: true },
    },
    {
      path: '/donation',
      name: 'Donation',
      component: () => import('@/views/Donation/_DonationPage.vue'),
      meta: { navVariant: 'landing' },
    },
    {
      path: '/editor/create',
      name: 'create-listing',
      component: CreateListingPublicRoute,
      meta: { navVariant: 'public' },
      beforeEnter: resolveCreateListingEntryRedirect,
    },
    {
      path: '/create-listing',
      name: 'create-listing-public',
      component: CreateListingPublicRoute,
      meta: { navVariant: 'public' },
    },
    {
      path: '/editor/:userId/create',
      name: 'create-listing-user',
      component: CreateListingRoute,
      meta: { navVariant: 'host' },
    },
    {
      path: '/editor',
      name: 'editor',
      component: EditorRoute,
      meta: { navVariant: 'host' },
      beforeEnter: (to) => resolveLegacyBackOfficeRedirect(to, 'editor-user'),
    },
    {
      path: '/editor/:userId',
      name: 'editor-user',
      component: EditorRoute,
      meta: { navVariant: 'host' },
    },
    {
      path: '/management',
      name: 'management',
      component: ManagementRoute,
      meta: { navVariant: 'host' },
      beforeEnter: (to) => resolveLegacyBackOfficeRedirect(to, 'management-user'),
    },
    {
      path: '/management/:userId',
      name: 'management-user',
      component: ManagementRoute,
      meta: { navVariant: 'host' },
    },
    {
      path: '/domains',
      name: 'domains',
      component: DomainsRoute,
      meta: { navVariant: 'host' },
      beforeEnter: (to) => resolveLegacyBackOfficeRedirect(to, 'domains-user'),
    },
    {
      path: '/domains/:userId',
      name: 'domains-user',
      component: DomainsRoute,
      meta: { navVariant: 'host' },
    },
    {
      path: '/messagerie',
      name: 'messaging',
      component: MessagingRoute,
      meta: { navVariant: 'host' },
      beforeEnter: (to) => resolveLegacyBackOfficeRedirect(to, 'messaging-user'),
    },
    {
      path: '/messagerie/:userId',
      name: 'messaging-user',
      component: MessagingRoute,
      meta: { navVariant: 'host' },
    },
  ],
})

router.beforeEach((to) => {
  if (typeof window === 'undefined') return true
  if (!isManagedListingHostname(window.location.hostname)) return true
  if (to.name === 'home' || to.name === 'listing' || to.name === 'listing-guide') return true
  return { name: 'home' }
})

export default router
