// File: src/main.ts

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { clerkPlugin } from '@clerk/vue'
import ui from '@nuxt/ui/vue-plugin'
import '@/externalUI.css'
import '@/main.scss'
// import VueSplide from '@splidejs/vue-splide'
// import '@splidejs/vue-splide/css'

import 'swiper/css'
import 'swiper/css/pagination'
import 'swiper/css/navigation'

// import LenisVue from 'lenis/vue'

import App from './App.vue'
import router from './router'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env')
}

const app = createApp(App)

app.use(ui)
// app.use(createHead())
app.use(clerkPlugin, {
  publishableKey: PUBLISHABLE_KEY,
})
// app.use(LenisVue)
app.use(createPinia())

app.use(router)
// app.use(VueSplide)

app.mount('#app')
