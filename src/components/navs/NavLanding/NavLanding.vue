<!-- File: src/components/navs/NavLanding/NavLanding.vue -->

<script setup lang="ts">
// DEPS
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'

// UTILS
import { vp } from '@/utils/viewport'

// ASSETS
import { icons } from '@/components/svgs'

const isMobileMenuOpen = ref(false)

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}

const route = useRoute()

const isDonation = computed(() => route.path === '/donation')
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
      <template v-if="!isDonation">
        <li>
          <a
            href=""
            data-target="#join-section"
          >
            Essayer gratuitement
          </a>
        </li>
        <li>
          <a
            href=""
            data-target="#features-section"
          >
            Fonctionnalités
          </a>
        </li>
        <li>
          <a
            href=""
            data-target="#how-section"
          >
            Comment ça marche ?
          </a>
        </li>
        <li>
          <a
            href=""
            data-target="#strengths-section"
          >
            Nos valeurs
          </a>
        </li>
      </template>
      <template v-else>
        <li>
          <a href="/"> Retour à l'accueil </a>
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
          <template v-if="!isDonation">
            <li>
              <a
                href=""
                data-target="#join-section"
                @click="toggleMobileMenu"
              >
                Essayer gratuitement
              </a>
            </li>
            <li>
              <a
                href=""
                data-target="#features-section"
                @click="toggleMobileMenu"
              >
                Fonctionnalités
              </a>
            </li>
            <li>
              <a
                href=""
                data-target="#how-section"
                @click="toggleMobileMenu"
              >
                Comment ça marche ?
              </a>
            </li>
            <li>
              <a
                href=""
                data-target="#strengths-section"
                @click="toggleMobileMenu"
              >
                Nos valeurs
              </a>
            </li>
          </template>
          <template v-else>
            <li>
              <a
                href="/"
                @click="toggleMobileMenu"
              >
                Retour à l'accueil
              </a>
            </li>
          </template>
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
