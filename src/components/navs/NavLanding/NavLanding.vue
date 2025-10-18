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

function scrollToTarget(e: MouseEvent, isDropdown: boolean = true) {
  e.preventDefault()

  if (!vp.lg.value && isDropdown) {
    toggleMobileMenu()
  }

  const link = e.currentTarget as HTMLAnchorElement
  const selector = link.dataset.target
  if (!selector) return

  const target = document.querySelector<HTMLElement>(selector)
  if (!target) return

  // const smoother = ScrollSmoother.get()
  // if (smoother) smoother.scrollTo(target, true)
  // else
  target.scrollIntoView({ behavior: 'smooth' })
}

const route = useRoute()

const isDonation = computed(() => route.path === '/donation')
</script>

<template>
  <nav class="navbar-landing">
    <button
      v-if="!isDonation"
      data-target="#hero-section"
      class="navbar__logo"
      @click="scrollToTarget($event, false)"
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
          <button
            href=""
            data-target="#join-section"
            @click="scrollToTarget"
          >
            Essayer gratuitement
          </button>
        </li>
        <li>
          <button
            href=""
            data-target="#features-section"
            @click="scrollToTarget"
          >
            Fonctionnalités
          </button>
        </li>
        <li>
          <button
            href=""
            data-target="#how-section"
            @click="scrollToTarget"
          >
            Comment ça marche ?
          </button>
        </li>
        <li>
          <button
            href=""
            data-target="#strengths-section"
            @click="scrollToTarget"
          >
            Nos valeurs
          </button>
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
              <button
                data-target="#join-section"
                @click="scrollToTarget"
              >
                Essayer gratuitement
              </button>
            </li>
            <li>
              <button
                data-target="#features-section"
                @click="scrollToTarget"
              >
                Fonctionnalités
              </button>
            </li>
            <li>
              <button
                data-target="#how-section"
                @click="scrollToTarget"
              >
                Comment ça marche ?
              </button>
            </li>
            <li>
              <button
                data-target="#strengths-section"
                @click="scrollToTarget"
              >
                Nos valeurs
              </button>
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
