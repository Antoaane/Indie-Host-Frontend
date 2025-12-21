// File: src/router/index.ts

import { defineAsyncComponent } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
const LandingPage = defineAsyncComponent(() => import('@/views/Landing/_LandingPage.vue'));
const Listing = defineAsyncComponent(() => import('@/views/Listing/_Listing.vue'));

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
    {
      path: '/donation',
      name: 'Donation',
      component: () => import('@/views/Donation/_DonationPage.vue'),
    },
    {
      path: '/blog',
      name: 'Blog',
      component: () => import('@/views/Blog/_BlogPage.vue'),
    },
    {
      path: '/blog/:slug',
      name: 'Article',
      component: () => import('@/views/Blog/_ArticlePage.vue'),
    },
  ],
})

export default router
