import { createRouter, createWebHistory } from 'vue-router'
import LandingPage from '../views/Landing/_LandingPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: LandingPage,
    },
  ],
})

export default router
