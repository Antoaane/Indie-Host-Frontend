<!-- File: src/views/Editor/components/EditorSidebar/EditorSidebarNav.vue -->

<script setup lang="ts">
import { computed } from 'vue'

type SidebarTab = 'listing' | 'pricing' | 'arrival'

const props = defineProps<{
  modelValue: SidebarTab
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: SidebarTab): void
}>()

const activeIndex = computed(() => {
  const order: SidebarTab[] = [
    'listing',
    'pricing',
    'arrival',
  ]
  const index = order.indexOf(props.modelValue)
  return index === -1 ? 0 : index
})

const tabsStyle = computed(() => ({
  '--active-index': String(activeIndex.value),
}))
</script>

<template>
  <nav
    class="editor-sidebar-nav"
    :style="tabsStyle"
  >
    <span class="bg-active" />
    <div
      class="tab"
      :class="{ 'is-active': props.modelValue === 'listing' }"
    >
      <button
        type="button"
        @click="emit('update:modelValue', 'listing')"
      >
        Annonce
      </button>
    </div>
    <div
      class="tab"
      :class="{ 'is-active': props.modelValue === 'pricing' }"
    >
      <button
        type="button"
        @click="emit('update:modelValue', 'pricing')"
      >
        Tarification
      </button>
    </div>
    <div
      class="tab"
      :class="{ 'is-active': props.modelValue === 'arrival' }"
    >
      <button
        type="button"
        @click="emit('update:modelValue', 'arrival')"
      >
        Arrivée
      </button>
    </div>
  </nav>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/editor-sidebar-nav.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/components/buttons' as buttons;

.editor-sidebar-nav {
  width: 100%;
  padding: 0.5rem;

  position: relative;

  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--layout-gap-xs);

  border-radius: borders.$rounded-xl;
  background-color: $accent;

  > .tab {
    position: relative;
    z-index: 2;

    > button {
      width: 100%;
      padding: 0.6rem 1rem 0.6rem 1rem;

      font-family: 'Outfit', sans-serif;
      font-weight: 500;
      font-size: 1rem;

      border: none;
      background: transparent;
    }

    &.is-active {
      > button {
        color: $accent !important;
      }
    }
  }

  > .bg-active {
    height: calc(100% - 1.2rem);
    width: calc((100% - 1.2rem - (var(--layout-gap-xs) * 2)) / 3);

    position: absolute;
    z-index: 0;
    top: 0.6rem;
    left: 0.6rem;

    background-color: $secondary;
    border-radius: borders.$rounded-md;

    transform: translate3d(calc(var(--active-index, 0) * (100% + var(--layout-gap-xs))), 0, 0);
    transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
    will-change: transform;
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    > .bg-active {
      transition: none;
    }
  }
}
</style>
