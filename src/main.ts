// File: src/main.ts

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@/assets/styles/main.scss'
import VueSplide from '@splidejs/vue-splide'
import '@splidejs/vue-splide/css'
import LenisVue from 'lenis/vue'
// import 'https://cdn.jsdelivr.net/npm/@splidejs/splide@4.1.4/dist/css/splide.min.css'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(LenisVue)
app.use(createPinia())
app.use(router)
app.use(VueSplide)

app.mount('#app')
