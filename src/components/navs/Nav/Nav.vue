<!-- File: src/components/navs/Nav/Nav.vue -->

<script setup lang="ts">
// DEPS
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/vue'

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
      class="logo"
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
      class="logo"
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
      class="search"
    >
      <input
        type="search"
        placeholder="Rechercher…"
        aria-label="Rechercher"
      />
    </div>

    <!-- Desktop Menu -->
    <ul
      class="links"
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
        <li>
          <SignedOut>
            <SignInButton>
              <button> Se connecter </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </li>
      </template>
    </ul>

    <!-- Mobile Menu Button -->
    <div
      class="mobile-toggle"
      :class="{ 'is-active': isMobileMenuOpen }"
      v-if="!vp.lg.value"
      @click="toggleMobileMenu"
      aria-label="Ouvrir/fermer le menu"
      role="button"
    >
      <span class="line is-top" />
      <span class="line is-bottom" />
    </div>

    <!-- Mobile Menu -->
    <transition name="fade-slide">
      <div
        class="mobile-menu"
        v-if="!vp.lg.value && isMobileMenuOpen"
      >
        <ul class="mobile-links">
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
            class="search"
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
</style>
