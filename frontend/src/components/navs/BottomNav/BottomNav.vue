<!-- File: src/components/navs/BottomNav/BottomNav.vue -->

<script setup lang="ts">
// DEPS
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
// UTILS
import { vp } from '@/utils/viewport'
// ICONS
import { Search, Plane, UserRound, MessageCircle } from 'lucide-vue-next'

const navItems = [
  { id: 'search', label: 'Rechercher', icon: Search },
  { id: 'trips', label: 'Voyages', icon: Plane },
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'messages', label: 'Messages', icon: MessageCircle },
] as const

const route = useRoute()
const listingPath = computed(() => {
  if (route.name === 'listing' && typeof route.path === 'string' && route.path.trim()) {
    return route.path
  }
  return '/'
})

const activeHash = computed(() => {
  if (route.name !== 'listing') return ''

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
      :to="`${listingPath}#${item.id}`"
      class="item"
      :class="{ 'is-active': isActive(item.id) }"
    >
      <component
        :is="item.icon"
        class="icon"
        :size="22"
        :stroke-width="2.5"
        aria-hidden="true"
      />
      <span class="label">
        {{ item.label }}
      </span>
    </RouterLink>
  </nav>
</template>

<style lang="scss">
/* File: src/components/navs/BottomNav/bottom-nav.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/animations' as animations;

.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  padding: 0.5rem 0.75rem calc(0.5rem + env(safe-area-inset-bottom));

  display: flex;
  gap: 0.5rem;

  background-color: $accent;
  border-top: 1px solid rgba($secondary, 0.08);
  box-shadow: 0 -6px 18px rgba($secondary, 0.1);

  z-index: 50;

  > .item {
    flex: 1;

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;

    padding: 0.65rem 0.5rem;

    text-decoration: none;
    color: rgba($secondary, 0.7);
    font-weight: 600;
    font-size: 0.9rem;

    border-radius: borders.$rounded-lg;

    @include animations.transition(0.18s, ease);

    &:active {
      transform: translateY(-1px);
    }

    &.is-active {
      color: $secondary;
      background-color: $accent-surface-2;
      box-shadow: inset 0 0 0 1px rgba($secondary, 0.08);
    }

    > .icon {
      width: 22px;
      height: 22px;
    }

    > .label {
      line-height: 1;
    }
  }
}
</style>
