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
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.perks-listing-comp {
  ul {
    display: flex;
    gap: var(--gutter-spacing-md);

    li {
      padding: var(--gutter-spacing-md);

      flex-grow: 1;
      flex-basis: 50%;

      display: flex;
      gap: var(--gutter-spacing-md);

      border: solid 1px $quaternary;
      border-radius: borders.$rounded-lg;

      .lucide {
        margin-top: var(--gutter-spacing-xs);

        flex-shrink: 0;
        flex-basis: 2rem;
        height: 2rem;

        stroke: $secondary;

        * {
          stroke: $secondary;
        }
      }

      div {
        flex-shrink: 1;

        h3 {
          margin-bottom: var(--gutter-spacing-xs) !important;
          font-weight: 500 !important;
          @include base-text;
        }

        p {
          opacity: 0.65;
          @include little-text($thin: false);
        }
      }
    }
  }
}
</style>
