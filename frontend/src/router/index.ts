// File: src/router/index.ts

import SignInView from '@/views/SignInView.vue'
import SignUpView from '@/views/SignUpView.vue'
import { createRouter, createWebHistory } from 'vue-router'
const LandingPage = () => import('@/views/Landing/_LandingPage.vue')
const PricingView = () => import('@/views/PricingView.vue')
const Listing = () => import('@/views/Listing/_Listing.vue')
const ListingGuide = () => import('@/views/ListingGuide/_ListingGuide.vue')
const EditorRoute = () => import('@/views/Editor/EditorRoute.vue')
const CreateListingRoute = () => import('@/views/CreateListing/CreateListingRoute.vue')
const MessagingRoute = () => import('@/views/Messaging/MessagingRoute.vue')
const ManagementRoute = () => import('@/views/Management/ManagementRoute.vue')

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: LandingPage,
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
      path: '/editor',
      name: 'editor',
      component: EditorRoute,
      meta: { navVariant: 'host' },
    },
    {
      path: '/editor/create',
      name: 'create-listing',
      component: CreateListingRoute,
      meta: { navVariant: 'host' },
    },
    {
      path: '/editor/:userId/create',
      name: 'create-listing-user',
      component: CreateListingRoute,
      meta: { navVariant: 'host' },
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
    },
    {
      path: '/management/:userId',
      name: 'management-user',
      component: ManagementRoute,
      meta: { navVariant: 'host' },
    },
    {
      path: '/messagerie',
      name: 'messaging',
      component: MessagingRoute,
      meta: { navVariant: 'host' },
    },
    {
      path: '/messagerie/:userId',
      name: 'messaging-user',
      component: MessagingRoute,
      meta: { navVariant: 'host' },
    },
  ],
})

export default router
