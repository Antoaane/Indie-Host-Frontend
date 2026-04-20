<!-- File: src/components/layouts/Footer.vue -->

<script setup lang="ts">
// DEPS
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const isLanding = computed(() => route.path === '/' || route.path === '/donation' || route.path === '/pricing')
</script>

<template>
  <footer
    v-if="isLanding"
    class="layout-footer"
  >
    <p><strong>© 2025 IndieHost</strong>. Tous droits réservés. | Fait avec ❤️ entre la montagne, la mer et le Wi-Fi instable. <a href="javascript:openAxeptioCookies()"> Préférences cookies </a></p>
  </footer>
</template>
