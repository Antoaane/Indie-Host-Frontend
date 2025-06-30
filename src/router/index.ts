// File: src/router/index.ts

import { createRouter, createWebHistory } from 'vue-router'
import LandingPage from '@/views/Landing/_LandingPage.vue'
import Listing from '@/views/Listing/_Listing.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: LandingPage,
    },
    {
      path: '/listing',
      name: 'listing',
      component: Listing,
    },
  ],
})

export default router
