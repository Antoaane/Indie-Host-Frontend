<!-- File: src/components/navs/Nav/BackOfficeDockNav.vue -->

<script setup lang="ts">
import type { Component } from 'vue'

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

function handleItemAction(item: { action?: (event?: MouseEvent) => void }, event: MouseEvent) {
  item.action?.(event)
}
</script>

<template>
  <nav
    class="back-office-dock-nav"
    aria-label="Navigation back-office"
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
      @click="item.action ? handleItemAction(item, $event) : undefined"
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
