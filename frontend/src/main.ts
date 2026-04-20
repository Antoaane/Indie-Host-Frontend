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
import detectOS from '@/utils/detectOs'
import { clerkDocumentLang, clerkLocalization } from '@/locales/clerk'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const IN_DEV_UTILITIES_ROOT_CLASS = 'in-dev-utilities-enabled'
const IN_DEV_UTILITIES_RAW = (import.meta.env.VITE_IN_DEV_UTILITIES_ENABLED ?? '').trim().toLowerCase()
const IN_DEV_UTILITIES_ENABLED = import.meta.env.DEV && ['1', 'true', 'yes', 'on'].includes(IN_DEV_UTILITIES_RAW)

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env')
}

if (IN_DEV_UTILITIES_ENABLED) {
  document.documentElement.classList.add(IN_DEV_UTILITIES_ROOT_CLASS)
}

const syncIosDetection = () => {
  const ua = (navigator.userAgent || '').toLowerCase()
  const platform = (navigator.platform || '').toLowerCase()
  return /iphone|ipad|ipod/.test(ua) || (platform === 'macintel' && navigator.maxTouchPoints > 1)
}

const isProbablyIos = syncIosDetection()
document.documentElement.classList.toggle('is-ios', isProbablyIos)
document.body.classList.toggle('is-ios', isProbablyIos)
document.documentElement.lang = clerkDocumentLang

void detectOS()
  .then((info) => {
    const normalizedOs = String(info?.os ?? '').toLowerCase()
    const isIos = normalizedOs === 'ios' || normalizedOs === 'ipados'
    document.documentElement.classList.toggle('is-ios', isIos)
    document.body.classList.toggle('is-ios', isIos)
  })
  .catch(() => {
    document.documentElement.classList.remove('is-ios')
    document.body.classList.remove('is-ios')
  })

const app = createApp(App)

app.use(ui)
app.use(clerkPlugin, {
  publishableKey: PUBLISHABLE_KEY,
  localization: clerkLocalization,
})
// app.use(LenisVue)
app.use(createPinia())

app.use(router)
// app.use(VueSplide)

app.mount('#app')
