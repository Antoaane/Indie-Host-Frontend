<!-- File: src/views/ListingView/components/Core/components/Perks/Perks.vue -->

<script setup lang="ts">
// DEPS
import * as LucideIcons from '@lucide/vue'
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

.listing-perks {
  // Une ligne par point fort : icône, titre, phrase. Encadré, chacun pesait autant qu'une carte
  // alors que rien ne s'y touche ; en lignes, ils se lisent d'un trait sous le titre.
  > .list {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: var(--layout-gap);

    .listing-view:not(.is-mobile-layout) & {
      grid-template-columns: repeat(2, 1fr);
    }

    > .item {
      display: flex;
      align-items: flex-start;
      gap: var(--layout-gap-md);

      > .icon {
        flex: 0 0 auto;
        width: 1.5rem;
        height: 1.5rem;
        color: $secondary-text;
      }

      > .body {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--layout-gap-2xs);

        > .title {
          @include base-text($bold: true);
        }

        > .description {
          @include base-text(rgba($secondary-text, 0.72), $thin: false);
        }
      }
    }
  }
}
</style>
