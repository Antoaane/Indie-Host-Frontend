<!-- File: src/components/navs/NavBlog/NavBlog.vue -->

<script setup lang="ts">
// DEPS
import { ref } from 'vue'
import { Search, X } from 'lucide-vue-next'

// UTILS
import { vp } from '@/utils/viewport'

// ASSETS
import { icons } from '@/components/svgs'

const isMobileMenuOpen = ref(false)
const isSearchOpen = ref(false)
const searchQuery = ref('')

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}

const openSearch = () => {
  isSearchOpen.value = true
  // Focus sur l'input après ouverture
  setTimeout(() => {
    const input = document.querySelector<HTMLInputElement>('.navbar__search-input')
    input?.focus()
  }, 100)
}

const closeSearch = () => {
  isSearchOpen.value = false
  searchQuery.value = ''
}

const handleSearchSubmit = (e: Event) => {
  e.preventDefault()
  if (searchQuery.value.trim()) {
    console.log('Recherche pour:', searchQuery.value)
    // TODO: Implémenter la logique de recherche
    window.dispatchEvent(new CustomEvent('blog:search', { detail: searchQuery.value }))
  }
}
</script>

<template>
  <nav class="navbar-landing">
    <a
      href="/"
      class="navbar__logo"
    >
      <component
        :is="icons.logoFull.adapt"
        title="IndieHost"
        desc="Logo de IndieHost, plateforme de gestion de locations saisonnières"
        role="img"
      />
    </a>

    <!-- Desktop Menu -->
    <ul
      class="navbar__links"
      v-if="vp.lg.value"
    >
      <!-- Navigation normale (visible si recherche fermée) -->
      <template v-if="!isSearchOpen">
        <li>
          <a href="/">Accueil</a>
        </li>
        <li>
          <a href="/blog">Blog</a>
        </li>
        <li>
          <a href="/donation" target="_blank" rel="noopener noreferrer">Soutenir le projet</a>
        </li>
        <li>
          <button
            class="navbar__search-btn"
            @click="openSearch"
            aria-label="Rechercher des articles"
          >
            <Search :size="20" />
            <span>Rechercher</span>
          </button>
        </li>
      </template>

      <!-- Champ de recherche (visible si recherche ouverte) -->
      <template v-else>
        <li class="navbar__search-container">
          <form @submit="handleSearchSubmit" class="navbar__search-form">
            <input
              v-model="searchQuery"
              type="text"
              class="navbar__search-input"
              placeholder="Que recherchez-vous ?"
              autocomplete="off"
            />
            <button
              type="button"
              class="navbar__search-close"
              @click="closeSearch"
              aria-label="Fermer la recherche"
            >
              <X :size="20" />
            </button>
          </form>
        </li>
      </template>
    </ul>

    <!-- Mobile Menu Button -->
    <div
      :class="{ 'navbar__mobile-toggle': true, active: isMobileMenuOpen }"
      v-if="!vp.lg.value"
      @click="toggleMobileMenu"
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
          <li>
            <a
              href="/"
              @click="toggleMobileMenu"
            >
              Accueil
            </a>
          </li>
          <li>
            <a
              href="/blog"
              @click="toggleMobileMenu"
            >
              Blog
            </a>
          </li>
          <li>
            <a
              href="/donation"
              target="_blank"
              rel="noopener noreferrer"
              @click="toggleMobileMenu"
            >
              Soutenir le projet
            </a>
          </li>
          <li>
            <button
              class="navbar__search-btn"
              @click="openSearch"
            >
              <Search :size="20" />
              <span>Rechercher</span>
            </button>
          </li>
        </ul>
      </div>
    </transition>
  </nav>
</template>

<style lang="scss" src="@/components/navs/NavBlog/nav-blog.scss"></style>
