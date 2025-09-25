<!-- File: src/components/navs/NavLanding/NavLanding.vue -->

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
  <nav class="navbar-listing">
    <a
      v-if="vp.lg.value"
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
        <a href="#join-section"> Tenez moi au courant ! </a>
      </li>
      <li>
        <a href="#habits-section"> Fonctionnalités </a>
      </li>
      <li>
        <a href="#usage-section"> Comment ça marche ? </a>
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
            <a
              href="#join-section"
              @click="toggleMobileMenu"
            >
              Tenez moi au courant !
            </a>
          </li>
          <li>
            <a
              href="#habits-section"
              @click="toggleMobileMenu"
            >
              Fonctionnalités
            </a>
          </li>
          <li>
            <a
              href="#usage-section"
              @click="toggleMobileMenu"
            >
              Comment ça marche ?
            </a>
          </li>
        </ul>
      </div>
    </transition>
  </nav>
</template>

<style lang="scss">
@use '@/components/navs/NavLanding/nav-landing.scss';

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
