<!-- File: src/views/ListingView/components/ListingCore/components/Perks/Perks.vue -->

<script setup lang="ts">
// DEPS
import * as LucideIcons from 'lucide-vue-next'
// TYPES
import type { PerkItem } from '@/views/ListingView/types/listing'
// CONTENT
const props = defineProps<{
  perks: PerkItem[]
}>()

// Transforme "rotate-ccw" ou "wifi" → "RotateCcw", "Wifi"
function toPascalCase(name: string): string {
  return name
    .split(/[-_]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('')
}

// Résout dynamiquement le composant icône Lucide
function resolveIcon(name: string) {
  const key = toPascalCase(name)
  return (LucideIcons as Record<string, any>)[key] ?? null
}
</script>

<template>
  <div class="perks-listing-comp">
    <ul>
      <li v-for="perk in perks">
        <component
          :is="resolveIcon(perk.icon)"
          class="perk-icon"
          aria-hidden="true"
        />
        <div>
          <h3>{{ perk.name }}</h3>
          <p>{{ perk.description }}</p>
        </div>
      </li>
    </ul>
  </div>
</template>

<style lang="scss">
@use '@/views/ListingView/components/ListingCore/components/Perks/perks.scss';
</style>
