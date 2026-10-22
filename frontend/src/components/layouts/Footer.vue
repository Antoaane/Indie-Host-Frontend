<!-- File: src/components/layouts/Footer.vue -->

<script setup lang="ts">
// DEPS
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const isLanding = computed(() => route.path === '/' || route.path === '/donation' || route.path === '/pricing')
// La landing a des boutons flottants (thème, haut de page) posés sur le pied de page.
const hasFloatingActions = computed(() => route.path === '/')
const currentYear = new Date().getFullYear()
// Le lien n'a de sens que si le gestionnaire de consentement Axeptio est chargé.
const canOpenCookiePreferences = typeof window !== 'undefined'
  && typeof (window as Window & { openAxeptioCookies?: unknown }).openAxeptioCookies === 'function'
</script>

<template>
  <footer
    v-if="isLanding"
    class="layout-footer"
    :class="{ 'has-floating-actions': hasFloatingActions }"
  >
    <p><strong>© {{ currentYear }} IndieHost</strong>. Tous droits réservés. | Fait avec ❤️ entre la montagne, la mer et le Wi-Fi instable.<template v-if="canOpenCookiePreferences"> <a href="javascript:openAxeptioCookies()">Préférences cookies</a></template></p>
  </footer>
</template>
