<!-- File: src/views/ListingView/components/Core/components/Perks/Perks.vue -->

<script setup lang="ts">
// DEPS
import * as LucideIcons from 'lucide-vue-next'
// TYPES
import type { PerkItem } from '@/views/ListingView/types/listing'
import { sanitizeHtml } from '@/utils/sanitizeHtml'
// CONTENT
const props = defineProps<{
  data: PerkItem[]
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
  <section class="listing-perks">
    <ul class="list">
      <li
        v-for="perk in data"
        :key="`${perk.source ?? 'perk'}:${perk.sourceId ?? perk.name}`"
        class="item"
      >
        <component
          :is="resolveIcon(perk.icon)"
          class="icon"
          aria-hidden="true"
        />
        <div class="body">
          <h3
            class="title"
            v-html="sanitizeHtml(perk.name)"
          />
          <p
            v-if="perk.description"
            class="description"
            v-html="sanitizeHtml(perk.description)"
          />
        </div>
      </li>
    </ul>
  </section>
</template>

<style lang="scss">
/* File: src/views/ListingView/components/Core/components/Perks/perks.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.listing-perks {
  > .list {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: var(--layout-gap-md);

    .listing-view:not(.is-mobile-layout) & {
      grid-template-columns: repeat(2, 1fr);
    }

    > .item {
      padding: var(--layout-gap-md);

      display: flex;
      align-items: center;
      gap: var(--layout-gap-md);

      border: solid 1px $quaternary;
      border-radius: borders.$rounded-lg;

      > .icon {
        flex-shrink: 0;
        flex-basis: 2rem;
        height: 2rem;

        stroke: $secondary;

        * {
          stroke: $secondary;
        }
      }

      > .body {
        flex-shrink: 1;

        > .title {
          margin-bottom: var(--layout-gap-2xs) !important;
          font-weight: 500 !important;
          @include base-text($bigger: true);
        }

        > .description {
          opacity: 0.65;
          @include little-text($thin: false);
        }
      }
    }
  }
}
</style>
