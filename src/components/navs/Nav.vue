<!-- File: src/components/navs/Nav.vue -->

<script setup lang="ts">
// DEPS
import { ref, onMounted } from 'vue'

// ASSETS
import { icons } from '@/components/svgs'

const isMobileMenuOpen = ref(false)
const isMobile = ref(false)

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}

const checkScreen = () => {
  isMobile.value = window.innerWidth < 1024
}

onMounted(() => {
  checkScreen()
  window.addEventListener('resize', checkScreen)
})
</script>

<template>
  <nav class="navbar">
    <div class="navbar__logo">
      <component :is="icons.logoFull.adapt" />
    </div>

    <!-- Desktop Menu -->
    <ul
      class="navbar__links"
      v-if="!isMobile"
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
      v-if="isMobile"
      @click="toggleMobileMenu"
    />

    <!-- Mobile Menu -->
    <transition name="fade-slide">
      <div
        class="navbar__mobile-menu"
        v-if="isMobile && isMobileMenuOpen"
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
