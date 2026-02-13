<!-- File: src/components/navs/Nav/NavLandingVariant.vue -->

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
    :full="false"
    logo-mode="scroll"
    logo-scroll-target="#hero-section"
  />
</template>
