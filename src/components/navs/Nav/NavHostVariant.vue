<!-- File: src/components/navs/Nav/NavHostVariant.vue -->

<script setup lang="ts">
import NavShell from '@/components/navs/Nav/NavShell.vue'
import type { NavItem } from '@/components/navs/Nav/navTypes'

defineProps<{
  items: NavItem[]
}>()
</script>

<template>
  <NavShell
    :items="items"
    logo-mode="link"
    logo-href="/"
  />
</template>
