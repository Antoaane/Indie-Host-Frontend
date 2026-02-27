<!-- File: src/components/navs/Nav/NavShell.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/vue'

import type { NavItem } from '@/components/navs/Nav/navTypes'
import { closeMobileMenu, isMobileMenuOpen, scrollToTarget, toggleMobileMenu } from '@/components/navs/navUtils'
import { vp } from '@/utils/viewport'

import { icons } from '@/components/svgs'

const props = withDefaults(
  defineProps<{
    items?: NavItem[]
    searchBar?: boolean
    full?: boolean
    showAuth?: boolean
    logoMode?: 'link' | 'scroll'
    logoHref?: string
    logoScrollTarget?: string
  }>(),
  {
    searchBar: false,
    full: true,
    showAuth: true,
    logoMode: 'link',
    logoHref: '/',
    logoScrollTarget: '#hero-section',
  },
)

const itemsUndefined = computed(() => typeof props.items === 'undefined')

const goBack = () => {
  if (window.history.length > 1) window.history.back()
}

function handleAction(item: NavItem, event: MouseEvent, closeMenuAfterClick: boolean = false) {
  item.action?.(event)
  if (closeMenuAfterClick) closeMobileMenu()
}
</script>

<template>
  <nav
    class="navbar"
    :class="{ contained: !full }"
  >
    <button
      v-if="logoMode === 'scroll'"
      type="button"
      :data-target="logoScrollTarget"
      class="logo"
      @click="scrollToTarget($event, false)"
      aria-label="IndieHost - Revenir en haut de page" title="IndieHost - Revenir en haut de page"
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
      :href="logoHref"
      class="logo"
      aria-label="IndieHost - Aller à l'accueil" title="IndieHost - Aller à l'accueil"
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

    <ul
      v-if="vp.lg.value"
      class="links"
    >
      <template v-if="itemsUndefined">
        <li>
          <button @click="goBack">Retour</button>
        </li>
      </template>

      <template v-else>
        <li
          v-for="item in props.items"
          :key="item.id"
          :class="{ cta: !!item.cta }"
        >
          <button
            v-if="item.action"
            type="button"
            :ref="item.ref"
            v-bind="item.attrs"
            @click="(event) => handleAction(item, event)"
          >
            {{ item.name }}
          </button>

          <a
            v-else-if="item.target"
            :href="item.link"
            :data-target="item.link"
            v-bind="item.attrs"
            :ref="item.ref"
            @click.prevent="scrollToTarget"
          >
            {{ item.name }}
          </a>

          <a
            v-else
            :href="item.link"
            v-bind="item.attrs"
            :ref="item.ref"
          >
            {{ item.name }}
          </a>
        </li>

        <li v-if="showAuth">
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

    <div
      v-if="!vp.lg.value"
      class="mobile-toggle"
      :class="{ 'is-active': isMobileMenuOpen }"
      @click="toggleMobileMenu"
      aria-label="Ouvrir/fermer le menu"
      role="button" title="Ouvrir/fermer le menu"
    >
      <span class="line is-top" />
      <span class="line is-bottom" />
    </div>

    <transition name="fade-slide">
      <div
        v-if="!vp.lg.value && isMobileMenuOpen"
        class="mobile-menu"
      >
        <ul class="mobile-links">
          <template v-if="itemsUndefined">
            <li>
              <button @click="goBack">Retour</button>
            </li>
          </template>

          <template v-else>
            <li
              v-for="item in props.items"
              :key="item.id"
              :class="{ cta: !!item.cta }"
            >
              <button
                v-if="item.action"
                type="button"
                v-bind="item.attrs"
                @click="(event) => handleAction(item, event, true)"
              >
                {{ item.name }}
              </button>

              <a
                v-else-if="item.target"
                :href="item.link"
                :data-target="item.link"
                v-bind="item.attrs"
                @click.prevent="scrollToTarget"
              >
                {{ item.name }}
              </a>

              <a
                v-else
                :href="item.link"
                v-bind="item.attrs"
                @click="closeMobileMenu"
              >
                {{ item.name }}
              </a>
            </li>
          </template>

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
