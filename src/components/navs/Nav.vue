<!-- File: src/components/navs/Nav.vue -->

<script setup lang="ts">
// DEPS
import { ref, onMounted } from 'vue'

// UTILS
import { vp } from '@/utils/viewport'

// ASSETS
import { icons } from '@/components/svgs'

const isMobileMenuOpen = ref(false)

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}
</script>

<template>
  <nav class="navbar">
    <a
      href="/#hero-section"
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
      <li>
        <RouterLink to="#home">Tenez moi au courant !</RouterLink>
      </li>
      <li>
        <RouterLink to="#about">Comment ça marche ?</RouterLink>
      </li>
      <li>
        <RouterLink to="#services">Pour qui ?</RouterLink>
      </li>
      <li>
        <RouterLink to="#contact">Contact</RouterLink>
      </li>
    </ul>

    <!-- Mobile Menu Button -->
    <component
      class="navbar__mobile-toggle"
      :is="icons.burgerMenu.adapt"
      v-if="!vp.lg.value"
      @click="toggleMobileMenu"
    />

    <!-- Mobile Menu -->
    <transition name="fade-slide">
      <div
        class="navbar__mobile-menu"
        v-if="!vp.lg.value && isMobileMenuOpen"
      >
        <ul class="navbar__mobile-links">
          <li>
            <RouterLink
              to="#home"
              @click="toggleMobileMenu"
              >Tenez moi au courant !</RouterLink
            >
          </li>
          <li>
            <RouterLink
              to="#about"
              @click="toggleMobileMenu"
              >Comment ça marche ?</RouterLink
            >
          </li>
          <li>
            <RouterLink
              to="#services"
              @click="toggleMobileMenu"
              >Pour qui ?</RouterLink
            >
          </li>
          <li>
            <RouterLink
              to="#contact"
              @click="toggleMobileMenu"
              >Contact</RouterLink
            >
          </li>
        </ul>
      </div>
    </transition>
  </nav>
</template>

<style scoped>
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
