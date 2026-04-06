<!-- File: src/components/navs/Nav/BackOfficeDockNav.vue -->

<script setup lang="ts">
import type { Component, ComponentPublicInstance } from 'vue'
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const props = withDefaults(
  defineProps<{
    items: Array<{
      id: string
      label: string
      link?: string
      icon: Component
      isActive?: boolean
      isPrimary?: boolean
      action?: (event?: MouseEvent) => void | Promise<void>
      attrs?: Record<string, string | number | boolean>
    }>
    optionsTriggerId?: string
    optionsOpen?: boolean
    optionsItems?: Array<{
      id: string
      label: string
      link?: string
      action?: (event?: MouseEvent) => void | Promise<void>
      attrs?: Record<string, string | number | boolean>
      isDanger?: boolean
      disabled?: boolean
    }>
  }>(),
  {
    optionsTriggerId: 'dock-options',
    optionsOpen: false,
    optionsItems: () => [],
  },
)

const emit = defineEmits<{
  (event: 'request-close-options'): void
}>()

const router = useRouter()
const optionsPanel = ref<HTMLElement | null>(null)
const optionsTrigger = ref<HTMLElement | null>(null)

function isInternalRouteLink(link: string | undefined): link is string {
  return typeof link === 'string' && link.startsWith('/') && !link.startsWith('//')
}

function isDefaultPrimaryClick(event: MouseEvent): boolean {
  if (event.defaultPrevented) return false
  if (event.button !== 0) return false
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  return true
}

function handleItemClick(
  item: {
    action?: (event?: MouseEvent) => void | Promise<void>
    link?: string
  },
  event: MouseEvent,
) {
  if (item.action) {
    item.action(event)
    return
  }

  if (!isDefaultPrimaryClick(event)) return
  if (!isInternalRouteLink(item.link)) return

  event.preventDefault()
  void router.push(item.link)
}

function setOptionsTriggerElement(element: Element | ComponentPublicInstance | null) {
  optionsTrigger.value = element instanceof HTMLElement ? element : null
}

function handleOptionItemClick(
  item: {
    action?: (event?: MouseEvent) => void | Promise<void>
    link?: string
    disabled?: boolean
  },
  event: MouseEvent,
) {
  if (item.disabled) {
    event.preventDefault()
    return
  }

  handleItemClick(item, event)
  emit('request-close-options')
}

function requestCloseOptions() {
  emit('request-close-options')
}

function isTargetInsideOptionsControls(target: EventTarget | null) {
  const node = target instanceof Node ? target : null
  if (!node) return false
  if (optionsPanel.value?.contains(node)) return true
  if (optionsTrigger.value?.contains(node)) return true
  return false
}

function handlePointerDown(event: PointerEvent) {
  if (!props.optionsOpen) return
  if (isTargetInsideOptionsControls(event.target)) return
  requestCloseOptions()
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (!props.optionsOpen) return
  if (event.key !== 'Escape') return
  event.preventDefault()
  requestCloseOptions()
}

watch(
  () => props.optionsOpen,
  (open) => {
    if (open) {
      window.addEventListener('pointerdown', handlePointerDown)
      window.addEventListener('keydown', handleWindowKeydown)
      return
    }

    window.removeEventListener('pointerdown', handlePointerDown)
    window.removeEventListener('keydown', handleWindowKeydown)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', handlePointerDown)
  window.removeEventListener('keydown', handleWindowKeydown)
})
</script>

<template>
  <nav
    class="back-office-dock-nav"
    aria-label="Navigation back-office"
    :style="{ '--dock-columns': String(items.length) }"
  >
    <component
      v-for="item in items"
      :key="item.id"
      :is="item.action ? 'button' : 'a'"
      class="item"
      :class="{ 'is-active': item.isActive, 'is-primary': item.isPrimary }"
      :type="item.action ? 'button' : undefined"
      :href="item.link"
      v-bind="item.attrs"
      :ref="item.id === optionsTriggerId ? setOptionsTriggerElement : undefined"
      @click="handleItemClick(item, $event)"
    >
      <component
        :is="item.icon"
        class="icon"
        :size="18"
        aria-hidden="true"
      />
      <span
        class="label"
        v-html="item.label"
      />
    </component>

    <transition name="dock-options-slide">
      <div
        v-if="optionsOpen && optionsItems.length"
        id="back-office-dock-options-menu"
        ref="optionsPanel"
        class="dock-options-menu"
        role="menu"
        aria-label="Options du back-office"
      >
        <component
          v-for="item in optionsItems"
          :key="item.id"
          :is="item.action ? 'button' : 'a'"
          class="dock-options-item"
          :class="{ 'is-danger': item.isDanger }"
          :type="item.action ? 'button' : undefined"
          :href="item.link"
          :disabled="item.action ? item.disabled : undefined"
          :aria-disabled="item.disabled || undefined"
          v-bind="item.attrs"
          role="menuitem"
          @click="handleOptionItemClick(item, $event)"
        >
          <span>{{ item.label }}</span>
        </component>
      </div>
    </transition>
  </nav>
</template>

<style lang="scss">
@use '@/components/navs/Nav/back-office-dock-nav.scss';
</style>
