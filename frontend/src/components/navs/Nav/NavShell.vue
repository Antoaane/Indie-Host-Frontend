<!-- File: src/components/navs/Nav/NavShell.vue -->

<script setup lang="ts">
import { SignedIn, SignedOut, UserButton } from '@clerk/vue'
import { UserRound } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import RelativeOverlay from '@/components/overlays/RelativeOverlay.vue'
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
const route = useRoute()
const signedOutAnchor = ref<HTMLElement | null>(null)
const authMenuPanel = ref<HTMLElement | null>(null)
const authMenuOpen = ref(false)

let authMenuCloseTimeout: number | null = null

const redirectUrl = computed(() => encodeURIComponent(route.fullPath || '/'))
const signInHref = computed(() => `/sign-in?redirect_url=${redirectUrl.value}`)
const signUpHref = computed(() => `/sign-up?redirect_url=${redirectUrl.value}`)

const goBack = () => {
  if (window.history.length > 1) window.history.back()
}

function clearAuthMenuCloseTimeout() {
  if (authMenuCloseTimeout === null) return
  window.clearTimeout(authMenuCloseTimeout)
  authMenuCloseTimeout = null
}

function openAuthMenu() {
  clearAuthMenuCloseTimeout()
  authMenuOpen.value = true
}

function closeAuthMenu() {
  clearAuthMenuCloseTimeout()
  authMenuOpen.value = false
}

function scheduleAuthMenuClose(delayMs = 110) {
  clearAuthMenuCloseTimeout()
  authMenuCloseTimeout = window.setTimeout(() => {
    authMenuOpen.value = false
    authMenuCloseTimeout = null
  }, delayMs)
}

function isTargetInsideAuthControls(target: EventTarget | null): boolean {
  const node = target instanceof Node ? target : null
  if (!node) return false
  if (signedOutAnchor.value?.contains(node)) return true
  if (authMenuPanel.value?.contains(node)) return true
  return false
}

function handleAuthFocusOut(event: FocusEvent) {
  if (isTargetInsideAuthControls(event.relatedTarget)) return
  scheduleAuthMenuClose(0)
}

function handleAuthKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeAuthMenu()
    return
  }

  if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
    event.preventDefault()
    openAuthMenu()
    window.requestAnimationFrame(() => {
      authMenuPanel.value?.querySelector<HTMLElement>('[data-auth-menu-item]')?.focus()
    })
  }
}

function handleAction(item: NavItem, event: MouseEvent, closeMenuAfterClick: boolean = false) {
  item.action?.(event)
  if (closeMenuAfterClick) closeMobileMenu()
}

watch(
  () => route.fullPath,
  () => {
    closeAuthMenu()
  },
)

watch(vp.lg, (isDesktop) => {
  if (!isDesktop) closeAuthMenu()
})

onBeforeUnmount(() => {
  clearAuthMenuCloseTimeout()
})
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
        <li class="nav-link-item">
          <button @click="goBack">Retour</button>
        </li>
      </template>

      <template v-else>
        <li
          v-for="item in props.items"
          :key="item.id"
          :class="['nav-link-item', { cta: !!item.cta }]"
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

        <li
          v-if="showAuth"
          class="auth-item"
        >
          <SignedOut>
            <div
              ref="signedOutAnchor"
              class="auth-menu-anchor"
              @mouseenter="openAuthMenu"
              @mouseleave="scheduleAuthMenuClose()"
              @focusin="openAuthMenu"
              @focusout="handleAuthFocusOut"
            >
              <button
                type="button"
                class="auth-avatar-button"
                aria-label="Ouvrir les options d'authentification"
                aria-haspopup="menu"
                :aria-expanded="authMenuOpen"
                @click="authMenuOpen ? closeAuthMenu() : openAuthMenu()"
                @keydown="handleAuthKeydown"
              >
                <UserRound :size="18" />
              </button>

              <RelativeOverlay
                class="nav-auth-overlay"
                :open="authMenuOpen"
                :anchor="signedOutAnchor"
                placement="bottom-end"
                :offset="10"
                role="menu"
                aria-label="Menu d'authentification"
                @close="closeAuthMenu"
              >
                <div
                  ref="authMenuPanel"
                  class="nav-auth-menu"
                  @mouseenter="openAuthMenu"
                  @mouseleave="scheduleAuthMenuClose()"
                  @focusin="openAuthMenu"
                  @focusout="handleAuthFocusOut"
                >
                  <a
                    :href="signInHref"
                    role="menuitem"
                    data-auth-menu-item
                    @click="closeAuthMenu"
                  >
                    Se connecter
                  </a>
                  <a
                    :href="signUpHref"
                    role="menuitem"
                    data-auth-menu-item
                    @click="closeAuthMenu"
                  >
                    S'inscrire
                  </a>
                </div>
              </RelativeOverlay>
            </div>
          </SignedOut>
          <SignedIn>
            <div class="auth-user-button">
              <UserButton />
            </div>
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
