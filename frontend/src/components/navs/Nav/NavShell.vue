<!-- File: src/components/navs/Nav/NavShell.vue -->

<script setup lang="ts">
import { SignedIn, SignedOut, useAuth, useClerk, useUser } from '@clerk/vue'
import { UserRound } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import HostProfileDialog from '@/components/navs/Nav/HostProfileDialog.vue'
import RelativeOverlay from '@/components/overlays/RelativeOverlay.vue'
import type { NavItem } from '@/components/navs/Nav/navTypes'
import { closeMobileMenu, isMobileMenuOpen, scrollToTarget, toggleMobileMenu } from '@/components/navs/navUtils'
import { clearSharedRequests } from '@/domain/api/requestCache'
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
const router = useRouter()
const { isSignedIn, user } = useUser()
const { signOut } = useAuth()
const clerk = useClerk()

const signedOutAnchor = ref<HTMLElement | null>(null)
const authMenuPanel = ref<HTMLElement | null>(null)
const authMenuOpen = ref(false)

const signedInAnchor = ref<HTMLElement | null>(null)
const profileMenuPanel = ref<HTMLElement | null>(null)
const profileMenuOpen = ref(false)
const myProfileDialogOpen = ref(false)

let authMenuCloseTimeout: number | null = null
let profileMenuCloseTimeout: number | null = null
// Menu ouvert par le survol : le clic qui suit le garde ouvert au lieu de le refermer.
let authMenuOpenedByHover = false
let profileMenuOpenedByHover = false

const redirectUrl = computed(() => encodeURIComponent(route.fullPath || '/'))
const signInHref = computed(() => `/sign-in?redirect_url=${redirectUrl.value}`)
const signUpHref = computed(() => `/sign-up?redirect_url=${redirectUrl.value}`)

const profileImageUrl = computed(() => {
  const imageUrl = user.value?.imageUrl
  if (typeof imageUrl !== 'string') return ''
  return imageUrl.trim()
})

const profileDisplayName = computed(() => {
  const firstName = typeof user.value?.firstName === 'string' ? user.value.firstName.trim() : ''
  const lastName = typeof user.value?.lastName === 'string' ? user.value.lastName.trim() : ''
  const combined = [firstName, lastName].filter(Boolean).join(' ').trim()
  if (combined) return combined

  const username = typeof user.value?.username === 'string' ? user.value.username.trim() : ''
  if (username) return username

  return 'mon profil'
})

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
  authMenuOpenedByHover = false
}

function openAuthMenuOnHover() {
  if (!authMenuOpen.value) authMenuOpenedByHover = true
  openAuthMenu()
}

function handleAuthAvatarClick() {
  if (authMenuOpen.value && authMenuOpenedByHover) {
    authMenuOpenedByHover = false
    return
  }
  if (authMenuOpen.value) closeAuthMenu()
  else openAuthMenu()
}

function scheduleAuthMenuClose(delayMs = 110) {
  clearAuthMenuCloseTimeout()
  authMenuCloseTimeout = window.setTimeout(() => {
    authMenuOpen.value = false
    authMenuOpenedByHover = false
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

function clearProfileMenuCloseTimeout() {
  if (profileMenuCloseTimeout === null) return
  window.clearTimeout(profileMenuCloseTimeout)
  profileMenuCloseTimeout = null
}

function openProfileMenu() {
  // « Mon profil » ouvert par-dessus : le retour du focus ou du survol ne rouvre pas le menu.
  if (myProfileDialogOpen.value) return
  clearProfileMenuCloseTimeout()
  profileMenuOpen.value = true
}

function closeProfileMenu() {
  clearProfileMenuCloseTimeout()
  profileMenuOpen.value = false
  profileMenuOpenedByHover = false
}

function openProfileMenuOnHover() {
  if (!profileMenuOpen.value) profileMenuOpenedByHover = true
  openProfileMenu()
}

function handleProfileAvatarClick() {
  if (profileMenuOpen.value && profileMenuOpenedByHover) {
    profileMenuOpenedByHover = false
    return
  }
  if (profileMenuOpen.value) closeProfileMenu()
  else openProfileMenu()
}

function scheduleProfileMenuClose(delayMs = 110) {
  clearProfileMenuCloseTimeout()
  profileMenuCloseTimeout = window.setTimeout(() => {
    profileMenuOpen.value = false
    profileMenuOpenedByHover = false
    profileMenuCloseTimeout = null
  }, delayMs)
}

function isTargetInsideProfileControls(target: EventTarget | null): boolean {
  const node = target instanceof Node ? target : null
  if (!node) return false
  if (signedInAnchor.value?.contains(node)) return true
  if (profileMenuPanel.value?.contains(node)) return true
  return false
}

function handleProfileFocusOut(event: FocusEvent) {
  if (isTargetInsideProfileControls(event.relatedTarget)) return
  scheduleProfileMenuClose(0)
}

function handleProfileKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeProfileMenu()
    return
  }

  if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
    event.preventDefault()
    openProfileMenu()
    window.requestAnimationFrame(() => {
      profileMenuPanel.value?.querySelector<HTMLElement>('[data-auth-menu-item]')?.focus()
    })
  }
}

function handleAction(item: NavItem, event: MouseEvent, closeMenuAfterClick: boolean = false) {
  item.action?.(event)
  if (closeMenuAfterClick) closeMobileMenu()
}

function isInternalRouteLink(link: string | undefined): link is string {
  return typeof link === 'string' && link.startsWith('/') && !link.startsWith('//')
}

function isDefaultPrimaryClick(event: MouseEvent): boolean {
  if (event.defaultPrevented) return false
  if (event.button !== 0) return false
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  return true
}

function handleLinkNavigation(item: NavItem, event: MouseEvent, closeMenuAfterClick: boolean = false) {
  if (closeMenuAfterClick) closeMobileMenu()
  if (!isDefaultPrimaryClick(event)) return
  if (!isInternalRouteLink(item.link)) return

  event.preventDefault()
  void router.push(item.link)
}

function handleOpenMyInformations() {
  closeProfileMenu()
  clerk.value?.openUserProfile()
}

function handleOpenMyProfile() {
  closeProfileMenu()
  myProfileDialogOpen.value = true
}

function closeMyProfileDialog() {
  myProfileDialogOpen.value = false
}

async function handleSignOut() {
  closeProfileMenu()
  clearSharedRequests()

  try {
    await signOut.value({ redirectUrl: '/' })
  } catch (error) {
    console.warn('[NavShell] impossible de se deconnecter', { error })
  }
}

watch(
  () => route.fullPath,
  () => {
    closeAuthMenu()
    closeProfileMenu()
    closeMyProfileDialog()
  },
)

watch(vp.lg, (isDesktop) => {
  if (!isDesktop) closeAuthMenu()
  if (!isDesktop) closeProfileMenu()
})

watch(
  () => isSignedIn.value,
  (signedIn) => {
    if (signedIn) return
    closeProfileMenu()
    closeMyProfileDialog()
  },
)

onBeforeUnmount(() => {
  clearAuthMenuCloseTimeout()
  clearProfileMenuCloseTimeout()
})
</script>

<template>
  <nav
    class="navbar"
    :class="{ contained: !full }"
  >
    <div
      v-if="!vp.lg.value"
      class="menu-container"
    >
      <div
        v-if="!vp.lg.value"
        class="mobile-toggle"
        :class="{ 'is-active': isMobileMenuOpen }"
        aria-label="Ouvrir/fermer le menu"
        role="button"
        title="Ouvrir/fermer le menu"
        @click="toggleMobileMenu"
      >
        <span class="line is-top" />
        <span class="line is-bottom" />
      </div>
    </div>

    <button
      v-if="logoMode === 'scroll'"
      type="button"
      :data-target="logoScrollTarget"
      class="logo"
      aria-label="IndieHost - Revenir en haut de page"
      title="IndieHost - Revenir en haut de page"
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
      :href="logoHref"
      class="logo"
      aria-label="IndieHost - Aller à l'accueil"
      title="IndieHost - Aller à l'accueil"
    >
      <component
        :is="icons.logoFull.adapt"
        title="IndieHost"
        desc="Logo de IndieHost, plateforme de gestion de locations saisonnières"
        role="img"
      />
    </a>

    <div
      v-if="showAuth && !vp.lg.value"
      class="auth-item"
    >
      <SignedOut>
        <div
          ref="signedOutAnchor"
          class="auth-menu-anchor"
          @mouseenter="openAuthMenuOnHover"
          @mouseleave="scheduleAuthMenuClose()"
          @focusout="handleAuthFocusOut"
        >
          <button
            type="button"
            class="auth-avatar-button"
            aria-label="Ouvrir les options d'authentification"
            aria-haspopup="menu"
            :aria-expanded="authMenuOpen"
            @click="handleAuthAvatarClick"
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
        <div
          ref="signedInAnchor"
          class="auth-menu-anchor"
          @mouseenter="openProfileMenuOnHover"
          @mouseleave="scheduleProfileMenuClose()"
          @focusout="handleProfileFocusOut"
        >
          <button
            type="button"
            class="auth-avatar-button"
            :class="{ 'has-image': profileImageUrl }"
            aria-label="Ouvrir les options du profil"
            aria-haspopup="menu"
            :aria-expanded="profileMenuOpen"
            @click="handleProfileAvatarClick"
            @keydown="handleProfileKeydown"
          >
            <img
              v-if="profileImageUrl"
              class="auth-avatar-image"
              :src="profileImageUrl"
              :alt="`Photo de profil de ${profileDisplayName}`"
            />
            <UserRound
              v-else
              :size="18"
            />
          </button>

          <RelativeOverlay
            class="nav-auth-overlay"
            :open="profileMenuOpen"
            :anchor="signedInAnchor"
            placement="bottom-end"
            :offset="10"
            role="menu"
            aria-label="Menu du profil"
            @close="closeProfileMenu"
          >
            <div
              ref="profileMenuPanel"
              class="nav-auth-menu"
              @mouseenter="openProfileMenu"
              @mouseleave="scheduleProfileMenuClose()"
              @focusin="openProfileMenu"
              @focusout="handleProfileFocusOut"
            >
              <button
                type="button"
                role="menuitem"
                data-auth-menu-item
                @click="handleOpenMyInformations"
              >
                Mes informations
              </button>
              <button
                type="button"
                role="menuitem"
                data-auth-menu-item
                @click="handleOpenMyProfile"
              >
                Mon profil
              </button>
              <button
                type="button"
                role="menuitem"
                class="is-danger"
                data-auth-menu-item
                @click="handleSignOut"
              >
                Se déconnecter
              </button>
            </div>
          </RelativeOverlay>
        </div>
      </SignedIn>
    </div>

    <div
      v-if="searchBar"
      class="search"
    >
      <input
        type="search"
        enterkeyhint="search"
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
            @click="(event) => handleLinkNavigation(item, event)"
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
              @mouseenter="openAuthMenuOnHover"
              @mouseleave="scheduleAuthMenuClose()"
              @focusout="handleAuthFocusOut"
            >
              <button
                type="button"
                class="auth-avatar-button"
                aria-label="Ouvrir les options d'authentification"
                aria-haspopup="menu"
                :aria-expanded="authMenuOpen"
                @click="handleAuthAvatarClick"
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
            <div
              ref="signedInAnchor"
              class="auth-menu-anchor"
              @mouseenter="openProfileMenuOnHover"
              @mouseleave="scheduleProfileMenuClose()"
              @focusout="handleProfileFocusOut"
            >
              <button
                type="button"
                class="auth-avatar-button"
                :class="{ 'has-image': profileImageUrl }"
                aria-label="Ouvrir les options du profil"
                aria-haspopup="menu"
                :aria-expanded="profileMenuOpen"
                @click="handleProfileAvatarClick"
                @keydown="handleProfileKeydown"
              >
                <img
                  v-if="profileImageUrl"
                  class="auth-avatar-image"
                  :src="profileImageUrl"
                  :alt="`Photo de profil de ${profileDisplayName}`"
                />
                <UserRound
                  v-else
                  :size="18"
                />
              </button>

              <RelativeOverlay
                class="nav-auth-overlay"
                :open="profileMenuOpen"
                :anchor="signedInAnchor"
                placement="bottom-end"
                :offset="10"
                role="menu"
                aria-label="Menu du profil"
                @close="closeProfileMenu"
              >
                <div
                  ref="profileMenuPanel"
                  class="nav-auth-menu"
                  @mouseenter="openProfileMenu"
                  @mouseleave="scheduleProfileMenuClose()"
                  @focusin="openProfileMenu"
                  @focusout="handleProfileFocusOut"
                >
                  <button
                    type="button"
                    role="menuitem"
                    data-auth-menu-item
                    @click="handleOpenMyInformations"
                  >
                    Mes informations
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    data-auth-menu-item
                    @click="handleOpenMyProfile"
                  >
                    Mon profil
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    class="is-danger"
                    data-auth-menu-item
                    @click="handleSignOut"
                  >
                    Se déconnecter
                  </button>
                </div>
              </RelativeOverlay>
            </div>
          </SignedIn>
        </li>
      </template>
    </ul>

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
                @click="(event) => handleLinkNavigation(item, event, true)"
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
              enterkeyhint="search"
              placeholder="Rechercher…"
              aria-label="Rechercher"
            />
          </div>
        </ul>
      </div>
    </transition>

    <HostProfileDialog
      :open="myProfileDialogOpen"
      @close="closeMyProfileDialog"
    />
  </nav>
</template>

<style lang="scss">
@use '@/components/navs/Nav/nav.scss';
</style>
