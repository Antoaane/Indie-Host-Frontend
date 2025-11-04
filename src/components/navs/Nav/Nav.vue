<!-- File: src/components/navs/Nav/Nav.vue -->

<script setup lang="ts">
// DEPS
import { computed } from 'vue'
import { useRoute } from 'vue-router' // ⬅️ new

// UTILS
import { vp } from '@/utils/viewport'
import { toggleMobileMenu, isMobileMenuOpen, scrollToTarget } from '@/components/navs/navUtils'

// ASSETS
import { icons } from '@/components/svgs'

// --- TYPES ---
type NavItem = {
  id: string
  index?: number
  name: string
  link: string
  cta?: boolean
  /**
   * Si true → ancre interne (scrollToTarget via data-target)
   * Si false (default) → lien standard (href)
   */
  target?: boolean
}

const props = withDefaults(
  defineProps<{
    items?: NavItem[]
    searchBar?: boolean
    full?: boolean
  }>(),
  {
    searchBar: false,
    full: true,
  },
)

// Si items n’est pas fourni du tout → on affiche le bouton “Retour”
const itemsUndefined = computed(() => typeof props.items === 'undefined')

const goBack = () => {
  if (window.history.length > 1) window.history.back()
}

// ⬇️ NEW: détecter si on est sur la landing page
const route = useRoute()
const isLanding = computed(() => route.path === '/')
</script>

<template>
  <nav
    class="navbar"
    :class="{ contained: !full }"
  >
    <!-- Logo -->
    <button
      v-if="isLanding"
      data-target="#hero-section"
      class="navbar__logo"
      @click="scrollToTarget($event, false)"
      aria-label="IndieHost - Revenir en haut de page"
    >
      <component
        :is="icons.logoFull.adapt"
        title="IndieHost"
        desc="Logo de IndieHost, plateforme de gestion de locations saisonnières"
        role="img"
      />
    </button>
    <a
      v-else
      href="/"
      class="navbar__logo"
      aria-label="IndieHost - Aller à l'accueil"
    >
      <component
        :is="icons.logoFull.adapt"
        title="IndieHost"
        desc="Logo de IndieHost, plateforme de gestion de locations saisonnières"
        role="img"
      />
    </a>

    <div
      v-if="searchBar"
      class="navbar__search"
    >
      <input
        type="search"
        placeholder="Rechercher…"
        aria-label="Rechercher"
      />
    </div>

    <!-- Desktop Menu -->
    <ul
      class="navbar__links"
      v-if="vp.lg.value"
    >
      <template v-if="itemsUndefined">
        <li>
          <button @click="goBack">Retour</button>
        </li>
      </template>

      <template v-else>
        <template
          v-for="(item, i) in props.items"
          :key="item.index || i"
        >
          <li :class="{ cta: !!item.cta }">
            <!-- Cas 1 : ancre interne (scroll vers section) -->
            <a
              v-if="item.target"
              :href="item.link"
              :data-target="item.link"
              @click.prevent="scrollToTarget"
            >
              {{ item.name }}
            </a>

            <!-- Cas 2 : lien classique -->
            <a
              v-else
              :href="item.link"
            >
              {{ item.name }}
            </a>
          </li>
        </template>
      </template>
    </ul>

    <!-- Mobile Menu Button -->
    <div
      :class="{ 'navbar__mobile-toggle': true, active: isMobileMenuOpen }"
      v-if="!vp.lg.value"
      @click="toggleMobileMenu"
      aria-label="Ouvrir/fermer le menu"
      role="button"
    >
      <span class="cheese" />
      <span class="steak" />
    </div>

    <!-- Mobile Menu -->
    <transition name="fade-slide">
      <div
        class="navbar__mobile-menu"
        v-if="!vp.lg.value && isMobileMenuOpen"
      >
        <ul class="navbar__mobile-links">
          <template v-if="itemsUndefined">
            <li>
              <button @click="goBack">Retour</button>
            </li>
          </template>

          <template v-else>
            <template
              v-for="(item, i) in props.items"
              :key="item.index || i"
            >
              <li :class="{ cta: !!item.cta }">
                <!-- Cas 1 : ancre interne -->
                <a
                  v-if="item.target"
                  :href="item.link"
                  :data-target="item.link"
                  @click.prevent="scrollToTarget"
                >
                  {{ item.name }}
                </a>

                <!-- Cas 2 : lien classique -->
                <a
                  v-else
                  :href="item.link"
                  @click="toggleMobileMenu"
                >
                  {{ item.name }}
                </a>
              </li>
            </template>
          </template>

          <!-- Barre de recherche (mobile) -->
          <div
            v-if="searchBar"
            class="navbar__search"
          >
            <input
              type="search"
              placeholder="Rechercher…"
              aria-label="Rechercher"
            />
          </div>
        </ul>
      </div>
    </transition>
  </nav>
</template>

<style lang="scss">
@use '@/components/navs/Nav/nav.scss';

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
