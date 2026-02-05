// File: src/router/index.ts

import SignInView from '@/views/SignInView.vue'
import { createRouter, createWebHistory } from 'vue-router'
const LandingPage = () => import('@/views/Landing/_LandingPage.vue')
const Listing = () => import('@/views/Listing/_Listing.vue')
const EditorRoute = () => import('@/views/Editor/EditorRoute.vue')
const MessagingView = () => import('@/views/Messaging/MessagingView.vue')
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
    },
    {
      path: '/listing/:id?',
      name: 'listing',
      component: Listing,
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
      component: MessagingView,
    },
  ],
})

export default router
