import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import ViteRestart from 'vite-plugin-restart'
import ui from '@nuxt/ui/vite'
import svgLoader from 'vite-svg-loader'
import svgToVuePlugin from './plugins/svg-to-vue/vite-plugin-svg-to-vue';
import fileCommentInjector from './plugins/file-path-comment/vite-plugin-file-comment'


// https://vite.dev/config/
export default defineConfig({
  plugins: [
    fileCommentInjector(),
    svgToVuePlugin(),
    ViteRestart({
      restart: ['src/assets/media/**/*.svg'], // Restart vite si des SVG changent
    }),
    vue(),
    ui(),
    vueDevTools(),
    svgLoader(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  server: {
    host: true,
    port: 5179
  },
  esbuild: {
    drop: ['debugger']
  }
})
