<!-- File: src/views/ListingView/components/Core/components/HouseRules/HouseRules.vue -->

<script setup lang="ts">
// Règlement intérieur de l'hôte sur l'annonce publique : aperçu replié, lecture complète en place.
// Même source que l'étape 4 du checkout (`arrival.practical.rules`, HTML Quill assaini).
import { computed, ref } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import type { HouseRulesModel } from '@/views/ListingView/types/listing'
import { sanitizeHtml } from '@/utils/sanitizeHtml'

const props = defineProps<{
  data: HouseRulesModel
}>()

// Copie locale : la section ne partage pas encore de clé avec `locales/_static/fr.json`.
const copy = {
  title: 'Règlement intérieur',
  expand: 'Voir le règlement',
  collapse: 'Masquer le règlement',
  ariaLabel: 'Règlement intérieur du logement',
}

const CONTENT_ID = 'listing-house-rules-content'

const html = computed(() => (props.data.text ? sanitizeHtml(props.data.html) : ''))
const isExpanded = ref(false)

function toggle() {
  isExpanded.value = !isExpanded.value
}
</script>

<template>
  <section
    v-if="html"
    class="listing-house-rules"
    :class="{ 'is-expanded': isExpanded }"
    :aria-label="copy.ariaLabel"
  >
    <h2>{{ copy.title }}</h2>

    <div
      v-if="!isExpanded"
      class="preview"
      v-html="html"
    />

    <div
      :id="CONTENT_ID"
      class="content"
      :aria-hidden="!isExpanded"
    >
      <div class="content-inner">
        <div
          class="content-html"
          v-html="html"
        />
      </div>
    </div>

    <div class="trigger">
      <button
        type="button"
        :aria-expanded="isExpanded"
        :aria-controls="CONTENT_ID"
        @click="toggle"
      >
        <span>{{ isExpanded ? copy.collapse : copy.expand }}</span>
        <ChevronDown
          :size="18"
          class="chevron"
          aria-hidden="true"
        />
      </button>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/ListingView/components/Core/components/HouseRules/house-rules.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/animations' as animations;
@use '@/styles/components/buttons' as buttons;

// HTML Quill assaini : même rendu pour l'aperçu et le contenu complet.
@mixin house-rules-html {
  @include base-text($thin: false);
  overflow-wrap: anywhere;
  word-break: break-word;

  p,
  ul,
  ol,
  blockquote {
    margin: 0 0 var(--layout-gap-xs);
  }

  ul,
  ol {
    padding-left: 1.2rem;
    list-style: disc;
  }

  ol {
    list-style: decimal;
  }

  li[data-list='bullet'] {
    list-style-type: disc;
  }

  li[data-list='ordered'] {
    list-style-type: decimal;
  }

  h2 {
    margin-top: var(--layout-gap-sm) !important;
    margin-bottom: var(--layout-gap-xs) !important;
    @include h3-title;
  }

  h3,
  h4 {
    margin-top: var(--layout-gap-sm) !important;
    margin-bottom: var(--layout-gap-xs) !important;
    @include h4-title;
  }

  a {
    color: $secondary-text;
    text-decoration: underline;
    text-underline-offset: 0.2rem;
  }
}

.listing-house-rules {
  > h2 {
    margin-bottom: var(--layout-gap-sm) !important;
    @include h2-title($gradiant: true);
  }

  > .preview {
    @include house-rules-html;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: normal;
  }

  // Dépliage sur la hauteur réelle du contenu (grid-template-rows), pas sur un max-height deviné.
  > .content {
    display: grid;
    grid-template-rows: 0fr;
    opacity: 0;
    @include animations.transition(animations.$duration-menu, animations.$ease-out, (grid-template-rows, opacity));

    > .content-inner {
      min-height: 0;
      overflow: hidden;

      > .content-html {
        @include house-rules-html;
      }
    }
  }

  &.is-expanded > .content {
    grid-template-rows: 1fr;
    opacity: 1;
  }

  > .trigger {
    margin-top: var(--layout-gap-sm);
    @include buttons.secondary($padding: false);

    > button {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;

      > .chevron {
        flex-shrink: 0;
        transform: rotate(0deg);
        @include animations.transition(animations.$duration-menu, animations.$ease-out, (transform));
      }
    }
  }

  &.is-expanded > .trigger > button > .chevron {
    transform: rotate(180deg);
  }

  @include animations.reduced-motion {
    > .content,
    > .trigger > button > .chevron {
      transition-duration: 0ms;
    }
  }
}
</style>
