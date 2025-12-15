// File: src/router/index.ts

import SignInView from '@/views/SignInView.vue'
import { createRouter, createWebHistory } from 'vue-router'
const LandingPage = () => import('@/views/Landing/_LandingPage.vue')
const Listing = () => import('@/views/Listing/_Listing.vue')

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: LandingPage,
    },
    {
      path: '/sign-in/:step(.*)*',
      name: 'sign-in',
      component: SignInView,
    },
    {
      path: '/listing-test/:id?',
      name: 'listing',
      component: Listing,
    },
    {
      path: '/donation',
      name: 'Donation',
      component: () => import('@/views/Donation/_DonationPage.vue'),
    },
  ],
})

export default router
