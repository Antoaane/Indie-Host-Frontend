<!-- File: src/views/Editor/components/EditorSidebar/EditorSidebarNav.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeft } from 'lucide-vue-next'
import { editorStatic } from '@/views/Editor/utils/editorContent'

type SidebarTab = 'listing' | 'pricing' | 'arrival'

const props = defineProps<{
  modelValue: SidebarTab
  showMobileBack?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: SidebarTab): void
  (e: 'mobile-back'): void
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

const tabsContent = editorStatic.sidebar.tabs
const actionsContent = editorStatic.actions
</script>

<template>
  <nav
    class="editor-sidebar-nav"
  >
    <div
      v-if="props.showMobileBack"
      class="mobile-back-shell"
    >
      <button
        type="button"
        class="mobile-back-btn"
        :aria-label="actionsContent.backToListings"
        :title="actionsContent.backToListings"
        @click="emit('mobile-back')"
      >
        <ArrowLeft :size="18" />
      </button>
    </div>

    <div
      class="tabs-track"
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
          {{ tabsContent.listing }}
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
          {{ tabsContent.pricing }}
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
          {{ tabsContent.arrival }}
        </button>
      </div>
    </div>
  </nav>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/editor-sidebar-nav.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.editor-sidebar-nav {
  width: 100%;
  padding: 0.5rem;

  position: relative;

  display: flex;
  align-items: stretch;
  gap: var(--layout-gap-xs);

  border-radius: borders.$rounded-xl;
  background-color: $accent;

  > .mobile-back-shell {
    flex: 0 0 auto;
    width: 2.75rem;
    min-width: 2.75rem;
    display: flex;
    align-items: center;
    justify-content: center;

    > .mobile-back-btn {
      width: 100%;
      height: 100%;
      min-height: 2.75rem;

      border: 1px solid rgba($secondary, 0.1);
      border-radius: borders.$rounded-md;
      background: rgba($accent-surface-2, 1);
      color: rgba($secondary-text, 0.95);
      cursor: pointer;

      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
  }

  > .tabs-track {
    flex: 1 1 auto;
    min-width: 0;
    position: relative;

    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--layout-gap-xs);

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
      height: calc(100% - 0.2rem);
      width: calc((100% - (var(--layout-gap-xs) * 2)) / 3);

      position: absolute;
      z-index: 0;
      top: 0.1rem;
      left: 0;

      background-color: $secondary;
      border-radius: borders.$rounded-md;

      transform: translate3d(calc(var(--active-index, 0) * (100% + var(--layout-gap-xs))), 0, 0);
      transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
      will-change: transform;
      pointer-events: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    > .tabs-track > .bg-active {
      transition: none;
    }
  }
}
</style>
