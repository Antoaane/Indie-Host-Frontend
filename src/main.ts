// File: src/main.ts

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './main.scss'
// import VueSplide from '@splidejs/vue-splide'
// import '@splidejs/vue-splide/css'

import 'swiper/css'
import 'swiper/css/pagination'
import 'swiper/css/navigation'

// import LenisVue from 'lenis/vue'
import { createHead } from '@unhead/vue/client'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createHead())
// app.use(LenisVue)
app.use(createPinia())
app.use(router)
// app.use(VueSplide)

app.mount('#app')
