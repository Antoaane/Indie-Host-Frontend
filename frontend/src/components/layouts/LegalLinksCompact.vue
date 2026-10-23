<!-- File: src/components/layouts/LegalLinksCompact.vue -->

<script setup lang="ts">
// Pied de page réduit des pages d'un hôte (annonce, page principale, guide, confirmation) :
// le pied de page global y est masqué (barre de réservation mobile), mais les mentions
// légales doivent rester accessibles. Une seule ligne de liens, repliable, centrée.
import { isListingHostname } from '@/domain/listings/publicDomain'
import { legalPages } from '@/views/Legal/legalPages'

withDefaults(
  defineProps<{
    /** Fond sur lequel les liens sont posés : `light` (texte sombre) ou `dark` (texte clair). */
    variant?: 'light' | 'dark'
  }>(),
  { variant: 'light' },
)

// Sur le domaine d'un hôte, le voyageur ne doit pas perdre sa page de réservation :
// les pages légales s'ouvrent dans un nouvel onglet.
const opensInNewTab = typeof window !== 'undefined' && isListingHostname(window.location.hostname)
const linkTarget = opensInNewTab ? '_blank' : undefined
const linkRel = opensInNewTab ? 'noopener' : undefined
const currentYear = new Date().getFullYear()
</script>

<template>
  <nav
    class="legal-links-compact"
    :class="`is-${variant}`"
    aria-label="Informations légales"
  >
    <ul>
      <li
        v-for="page in legalPages"
        :key="page.slug"
      >
        <RouterLink
          :to="`/legal/${page.slug}`"
          :target="linkTarget"
          :rel="linkRel"
        >
          {{ page.navLabel }}<span
            v-if="opensInNewTab"
            class="sr-only"
          > (nouvel onglet)</span>
        </RouterLink>
      </li>
      <li>
        <a href="mailto:contact@indiehost.fr">Contact</a>
      </li>
      <li class="copyright">© {{ currentYear }} IndieHost</li>
    </ul>
  </nav>
</template>

<style lang="scss">
/* File: src/components/layouts/LegalLinksCompact.vue */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/animations' as animations;

.legal-links-compact {
  --ui-legal-links-text: #{rgba($secondary, 0.6)};
  --ui-legal-links-text-strong: #{$secondary};

  padding-block: var(--layout-gap-xs);
  padding-inline: var(--layout-gap-sm);

  &.is-dark {
    --ui-legal-links-text: #{rgba($accent, 0.7)};
    --ui-legal-links-text-strong: #{$accent};
  }

  >ul {
    margin: 0;
    padding: 0;
    list-style: none;

    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    column-gap: var(--layout-gap-sm);
  }

  >ul>li {
    display: inline-flex;
    align-items: center;
    @include little-text(var(--ui-legal-links-text), $thin: false);
  }

  >ul>li>a {
    display: inline-flex;
    align-items: center;
    min-height: 2rem;
    color: inherit;
    text-decoration: none;
    @include animations.transition(animations.$duration-fast, animations.$ease-out, color);

    @include on-hover {
      color: var(--ui-legal-links-text-strong);
    }

    &:focus-visible {
      color: var(--ui-legal-links-text-strong);
      outline: 2px solid var(--ui-legal-links-text-strong);
      outline-offset: 2px;
      border-radius: borders.$rounded-xs;
    }

    // Cible tactile : la hauteur de ligne ne suffit pas au doigt.
    @media (pointer: coarse) {
      min-height: 44px;
      min-width: 44px;
      justify-content: center;
    }
  }
}
</style>
