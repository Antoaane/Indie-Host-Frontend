<!-- File: src/views/Editor/components/EditorSidebar/panels/PanelHeader.vue -->

<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { Info } from 'lucide-vue-next'

// En-tête de panneau : titre, une ligne de résumé, et l'explication longue repliée derrière ⓘ.
// L'aide se lit une fois ; elle ne doit pas occuper la colonne à chaque visite.
const props = defineProps<{
  title: string
  summary?: string
  helpLabel?: string
}>()

const helpId = useId()
const isHelpOpen = ref(false)
const toggleLabel = computed(() => props.helpLabel ?? (isHelpOpen.value ? 'Masquer l’aide' : 'En savoir plus'))

function toggleHelp() {
  isHelpOpen.value = !isHelpOpen.value
}
</script>

<template>
  <div class="editor-panel-header">
    <div class="row">
      <div class="main">
        <h3>{{ props.title }}</h3>
        <p v-if="props.summary">{{ props.summary }}</p>
      </div>

      <div
        v-if="$slots.default"
        class="help-toggle"
      >
        <button
          type="button"
          :aria-expanded="isHelpOpen"
          :aria-controls="helpId"
          :aria-label="toggleLabel"
          :title="toggleLabel"
          @click="toggleHelp"
        >
          <Info :size="17" />
        </button>
      </div>
    </div>

    <div
      v-if="$slots.default"
      :id="helpId"
      class="help"
      :class="{ 'is-open': isHelpOpen }"
      :inert="!isHelpOpen"
    >
      <div class="help-inner">
        <div class="help-text">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/animations' as animations;
@use '@/styles/components/buttons' as buttons;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-panel-header {
  margin-bottom: var(--layout-gap);

  > .row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--layout-gap-sm);

    > .main {
      min-width: 0;
      flex: 1 1 auto;

      > h3 {
        @extend %panel-title;
      }

      > p {
        @extend %panel-subtitle;
      }
    }

    > .help-toggle {
      flex: 0 0 auto;
      @include buttons.primary($theme: white, $icon-only: true, $deep: true);

      > * {
        width: 2.5rem;
        height: 2.5rem;

        @media (pointer: coarse) {
          width: 2.75rem;
          height: 2.75rem;
        }
      }

      // Bouton « enfoncé » tant que l'aide est ouverte : même rendu que le survol.
      > [aria-expanded='true'] {
        color: $accent;
        background-color: $secondary-button-reference;

        * {
          color: $accent;
          stroke: $accent;
        }
      }
    }
  }

  // Dépliage : hauteur par grille (pas de mesure JS) + opacité ; fermeture plus rapide.
  > .help {
    display: grid;
    grid-template-rows: 0fr;
    opacity: 0;
    @include animations.transition(animations.$duration-exit, animations.$ease-out, (grid-template-rows, opacity, margin-top));

    &.is-open {
      grid-template-rows: 1fr;
      opacity: 1;
      margin-top: var(--layout-gap-sm);
      transition-duration: animations.$duration-menu;
    }

    > .help-inner {
      min-height: 0;
      overflow: hidden;

      > .help-text {
        padding: var(--layout-gap-sm) var(--layout-gap-md);
        border-radius: borders.$rounded-sm;
        background: $accent-surface-1;
        @include little-text($thin: false);
        color: rgba($secondary-text, 0.85);

        > p {
          margin: 0;

          + p {
            margin-top: var(--layout-gap-xs);
          }
        }
      }
    }

    @include animations.reduced-motion {
      transition: none;
    }
  }
}
</style>
