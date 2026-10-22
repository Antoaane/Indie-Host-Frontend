<!-- File: src/components/layouts/Footer.vue -->

<script setup lang="ts">
// DEPS
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { isListingHostname } from '@/domain/listings/publicDomain'
import { legalPages } from '@/views/Legal/legalPages'

const route = useRoute()

const isOnListingHostname = typeof window !== 'undefined' && isListingHostname(window.location.hostname)
const isLegal = computed(() => route.name === 'legal')
// Sur le domaine d'un hôte, « / » est sa page de réservation : pas de pied de page marketing.
const isLanding = computed(() => !isOnListingHostname && (route.path === '/' || route.path === '/donation' || route.path === '/pricing'))
const isVisible = computed(() => isLanding.value || isLegal.value)
// La landing a des boutons flottants (thème, haut de page) posés sur le pied de page.
const hasFloatingActions = computed(() => isLanding.value && route.path === '/')
const currentYear = new Date().getFullYear()
</script>

<template>
  <footer
    v-if="isVisible"
    class="layout-footer"
    :class="{ 'has-floating-actions': hasFloatingActions }"
  >
    <nav
      class="layout-footer__legal"
      aria-label="Informations légales"
    >
      <RouterLink
        v-for="page in legalPages"
        :key="page.slug"
        :to="`/legal/${page.slug}`"
      >
        {{ page.navLabel }}
      </RouterLink>
      <a href="mailto:contact@indiehost.fr">Contact</a>
    </nav>
    <p><strong>© {{ currentYear }} IndieHost</strong>. Tous droits réservés.<template v-if="isLanding"> | Fait avec ❤️ entre la montagne, la mer et le Wi-Fi instable.</template></p>
  </footer>
</template>
