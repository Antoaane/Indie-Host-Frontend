<!-- File: src/components/navs/NavListing/NavListing.vue -->

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
  <nav class="navbar-landing">
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
        <a href="#join-section"> Messagerie </a>
      </li>
      <li>
        <a href="#habits-section"> Réservations </a>
      </li>
      <li>
        <a href="#usage-section"> Devenir hôte </a>
      </li>
      <!-- <li>
        Profile Icon
      </li>
      <li>
        Setting Icon
      </li> -->
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
              Messagerie
            </a>
          </li>
          <li>
            <a
              href="#habits-section"
              @click="toggleMobileMenu"
            >
              Réservations
            </a>
          </li>
          <li>
            <a
              href="#usage-section"
              @click="toggleMobileMenu"
            >
              Devenir hôte
            </a>
          </li>
        </ul>
      </div>
    </transition>
  </nav>
</template>

<style lang="scss">
@use '@/components/navs/NavListing/nav-listing.scss';

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
