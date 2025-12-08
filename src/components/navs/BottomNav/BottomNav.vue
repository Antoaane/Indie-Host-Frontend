<!-- File: src/components/navs/BottomNav/BottomNav.vue -->

<script setup lang="ts">
// DEPS
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
// UTILS
import { vp } from '@/utils/viewport'
// ICONS
import { Search, Plane, UserRound, MessageCircle } from 'lucide-vue-next'

const LISTING_PATH = '/listing-test/33333333-3333-3333-3333-333333333333'

const navItems = [
  { id: 'search', label: 'Rechercher', icon: Search },
  { id: 'trips', label: 'Voyages', icon: Plane },
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'messages', label: 'Messages', icon: MessageCircle },
] as const

const route = useRoute()

const activeHash = computed(() => {
  if (route.path !== LISTING_PATH) return ''

  return route.hash || '#search'
})

const isActive = (id: string) => activeHash.value === `#${id}`
</script>

<template>
  <nav
    v-if="!vp.lg.value"
    class="bottom-nav"
  >
    <RouterLink
      v-for="item in navItems"
      :key="item.id"
      :to="`${LISTING_PATH}#${item.id}`"
      class="bottom-nav__item"
      :class="{ active: isActive(item.id) }"
    >
      <component
        :is="item.icon"
        class="bottom-nav__icon"
        :size="22"
        :stroke-width="2.5"
        aria-hidden="true"
      />
      <span class="bottom-nav__label">
        {{ item.label }}
      </span>
    </RouterLink>
  </nav>
</template>

<style lang="scss">
@use '@/components/navs/BottomNav/bottom-nav.scss';
</style>
