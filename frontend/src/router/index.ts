// File: src/router/index.ts

import SignInView from '@/views/SignInView.vue'
import SignUpView from '@/views/SignUpView.vue'
import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'
import { isManagedListingHostname } from '@/domain/listings/publicDomain'
import { normalizeListingSlug } from '@/domain/listings/slug'
import { resolveRuntimeUserId } from '@/router/backOfficeUser'
const HomePage = () => {
  if (typeof window !== 'undefined' && isManagedListingHostname(window.location.hostname)) {
    return import('@/views/Listing/_Listing.vue')
  }
  return import('@/views/Landing/_LandingPage.vue')
}
const PricingView = () => import('@/views/PricingView.vue')
const PricingChecklistCallbackView = () => import('@/views/PricingCallbacks/PricingChecklistCallbackView.vue')
const Listing = () => import('@/views/Listing/_Listing.vue')
const ListingGuide = () => import('@/views/ListingGuide/_ListingGuide.vue')
const BookingConfirmationView = () => import('@/views/BookingConfirmation/BookingConfirmationView.vue')
const EditorRoute = () => import('@/views/Editor/EditorRoute.vue')
const CreateListingRoute = () => import('@/views/CreateListing/CreateListingRoute.vue')
const CreateListingPublicRoute = () => import('@/views/CreateListing/CreateListingPublicRoute.vue')
const MessagingRoute = () => import('@/views/Messaging/MessagingRoute.vue')
const ManagementRoute = () => import('@/views/Management/ManagementRoute.vue')
const DomainsRoute = () => import('@/views/Domains/DomainsRoute.vue')

async function resolveBackOfficeAccess(to: RouteLocationNormalized) {
  const userId = await resolveRuntimeUserId({
    waitMs: 1500,
    pollIntervalMs: 75,
  })

  if (userId) {
    return true
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
      path: '/pricing/callback',
      name: 'pricing-callback',
      component: PricingChecklistCallbackView,
      meta: { navVariant: 'public' },
    },
    {
      path: '/pricing/callback/auth',
      name: 'pricing-callback-auth',
      component: PricingChecklistCallbackView,
      meta: { navVariant: 'public' },
    },
    {
      path: '/pricing/callback/checkout',
      name: 'pricing-callback-checkout',
      component: PricingChecklistCallbackView,
      meta: { navVariant: 'public' },
    },
    {
      path: '/pricing/callback/connect',
      name: 'pricing-callback-connect',
      component: PricingChecklistCallbackView,
      meta: { navVariant: 'public' },
    },
    {
      path: '/listing/guide/:id',
      name: 'listing-guide',
      component: ListingGuide,
      meta: { hideNav: true },
    },
    {
      path: '/booking/confirmation/:reservationId',
      name: 'booking-confirmation',
      component: BookingConfirmationView,
      meta: { navVariant: 'public', hideNav: true },
    },
    {
      path: '/donation',
      name: 'Donation',
      component: () => import('@/views/Donation/_DonationPage.vue'),
      meta: { navVariant: 'landing' },
    },
    {
      path: '/dashboard/editor/create',
      name: 'create-listing',
      component: CreateListingPublicRoute,
      meta: { navVariant: 'public', hideNav: true },
      beforeEnter: resolveCreateListingEntryRedirect,
    },
    {
      path: '/create-listing',
      name: 'create-listing-public',
      component: CreateListingPublicRoute,
      meta: { navVariant: 'public', hideNav: true },
    },
    {
      path: '/dashboard/editor/:userId/create',
      name: 'create-listing-user',
      component: CreateListingRoute,
      meta: { navVariant: 'host', hideNav: true },
    },
    {
      path: '/dashboard/editor',
      name: 'editor',
      component: EditorRoute,
      meta: { navVariant: 'host' },
      beforeEnter: resolveBackOfficeAccess,
    },
    {
      path: '/dashboard/editor/:userId',
      name: 'editor-user',
      component: EditorRoute,
      meta: { navVariant: 'host' },
    },
    {
      path: '/dashboard/management',
      name: 'management',
      component: ManagementRoute,
      meta: { navVariant: 'host' },
      beforeEnter: resolveBackOfficeAccess,
    },
    {
      path: '/dashboard/management/:userId',
      name: 'management-user',
      component: ManagementRoute,
      meta: { navVariant: 'host' },
    },
    {
      path: '/dashboard/domains',
      name: 'domains',
      component: DomainsRoute,
      meta: { navVariant: 'host' },
      beforeEnter: resolveBackOfficeAccess,
    },
    {
      path: '/dashboard/domains/:userId',
      name: 'domains-user',
      component: DomainsRoute,
      meta: { navVariant: 'host' },
    },
    {
      path: '/dashboard/messages',
      name: 'messaging',
      component: MessagingRoute,
      meta: { navVariant: 'host' },
      beforeEnter: resolveBackOfficeAccess,
    },
    {
      path: '/dashboard/messages/:userId',
      name: 'messaging-user',
      component: MessagingRoute,
      meta: { navVariant: 'host' },
    },
    {
      path: '/editor/create',
      redirect: (to) => ({
        name: 'create-listing',
        query: to.query,
        hash: to.hash,
      }),
    },
    {
      path: '/editor/:userId/create',
      redirect: (to) => ({
        name: 'create-listing-user',
        params: to.params,
        query: to.query,
        hash: to.hash,
      }),
    },
    {
      path: '/editor',
      redirect: (to) => ({
        name: 'editor',
        query: to.query,
        hash: to.hash,
      }),
    },
    {
      path: '/editor/:userId',
      redirect: (to) => ({
        name: 'editor-user',
        params: to.params,
        query: to.query,
        hash: to.hash,
      }),
    },
    {
      path: '/management',
      redirect: (to) => ({
        name: 'management',
        query: to.query,
        hash: to.hash,
      }),
    },
    {
      path: '/management/:userId',
      redirect: (to) => ({
        name: 'management-user',
        params: to.params,
        query: to.query,
        hash: to.hash,
      }),
    },
    {
      path: '/messagerie',
      redirect: (to) => ({
        name: 'messaging',
        query: to.query,
        hash: to.hash,
      }),
    },
    {
      path: '/messagerie/:userId',
      redirect: (to) => ({
        name: 'messaging-user',
        params: to.params,
        query: to.query,
        hash: to.hash,
      }),
    },
    {
      path: '/domains',
      redirect: (to) => ({
        name: 'domains',
        query: to.query,
        hash: to.hash,
      }),
    },
    {
      path: '/domains/:userId',
      redirect: (to) => ({
        name: 'domains-user',
        params: to.params,
        query: to.query,
        hash: to.hash,
      }),
    },
    {
      path: '/listing',
      redirect: { name: 'home' },
    },
    {
      path: '/listing/:slug',
      redirect: (to) => {
        const raw = to.params.slug
        const slug = normalizeListingSlug(typeof raw === 'string' ? raw : '')
        if (!slug) return { name: 'home' }
        return {
          name: 'listing',
          params: { slug },
          query: to.query,
          hash: to.hash,
        }
      },
    },
    {
      path: '/:slug([a-z0-9-]+)',
      name: 'listing',
      component: Listing,
      meta: { hideNav: true },
    },
  ],
})

router.beforeEach((to) => {
  if (typeof window === 'undefined') return true
  if (!isManagedListingHostname(window.location.hostname)) return true
  if (to.name === 'home' || to.name === 'listing' || to.name === 'listing-guide' || to.name === 'booking-confirmation') return true
  return { name: 'home' }
})

export default router
