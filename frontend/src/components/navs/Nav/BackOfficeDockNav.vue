<!-- File: src/components/navs/Nav/BackOfficeDockNav.vue -->

<script setup lang="ts">
import type { Component } from 'vue'
import { useRouter } from 'vue-router'

defineProps<{
  items: Array<{
    id: string
    label: string
    link?: string
    icon: Component
    isActive?: boolean
    isPrimary?: boolean
    action?: (event?: MouseEvent) => void
    attrs?: Record<string, string | number | boolean>
  }>
}>()

const router = useRouter()

function isInternalRouteLink(link: string | undefined): link is string {
  return typeof link === 'string' && link.startsWith('/') && !link.startsWith('//')
}

function isDefaultPrimaryClick(event: MouseEvent): boolean {
  if (event.defaultPrevented) return false
  if (event.button !== 0) return false
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  return true
}

function handleItemClick(item: { action?: (event?: MouseEvent) => void; link?: string }, event: MouseEvent) {
  if (item.action) {
    item.action(event)
    return
  }

  if (!isDefaultPrimaryClick(event)) return
  if (!isInternalRouteLink(item.link)) return

  event.preventDefault()
  void router.push(item.link)
}
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
      @click="handleItemClick(item, $event)"
    >
      <component
        :is="item.icon"
        class="icon"
        :size="18"
        aria-hidden="true"
      />
      <span class="label">
        {{ item.label }}
      </span>
    </component>
  </nav>
</template>

<style lang="scss">
@use '@/components/navs/Nav/back-office-dock-nav.scss';
</style>
