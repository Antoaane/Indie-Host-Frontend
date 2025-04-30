import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import ViteRestart from 'vite-plugin-restart'
import svgLoader from 'vite-svg-loader'
import svgToVuePlugin from './plugins/vite-plugin-svg-to-vue';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    svgToVuePlugin(),
    ViteRestart({
      restart: ['src/assets/media/**/*.svg'], // Restart vite si des SVG changent
    }),
    vue(),
    vueDevTools(),
    svgLoader(),
  ],
  server: {
    watch: {
      // Dossier qu'on VEUT surveiller => on l'enlève des ignorés
      ignored: ['!**/src/assets/media**']
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
