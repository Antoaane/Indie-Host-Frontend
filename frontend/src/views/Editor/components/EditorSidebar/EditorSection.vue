<!-- File: src/views/Editor/components/EditorSidebar/EditorSection.vue -->

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { ChevronDown } from 'lucide-vue-next'

import {
  EDITOR_SECTIONS_KEY,
  editorSectionDomId,
  type EditorSectionId,
} from '@/views/Editor/components/EditorSidebar/editorSections'
import { editorStatic } from '@/views/Editor/utils/editorContent'

// Une section de l'éditeur : une ligne repliée (nom, résumé d'une ligne, « À compléter ») qui s'ouvre
// sur son panneau. La colonne tient ainsi sur un écran et se lit comme un sommaire ; le résumé et
// l'état ouvert viennent de la barre latérale (`EditorSidebar.vue`).
const props = defineProps<{
  section: EditorSectionId
}>()

const sections = inject(EDITOR_SECTIONS_KEY, null)

const domId = computed(() => editorSectionDomId(props.section))
const bodyId = computed(() => `${domId.value}-panel`)
const isOpen = computed(() => (sections ? sections.isOpen(props.section) : true))
const label = computed(() => sections?.labelOf(props.section) ?? '')
const summary = computed(() => sections?.summaryOf(props.section) ?? '')
const isTodo = computed(() => sections?.isTodo(props.section) ?? false)

// Le panneau n'est monté qu'à sa première ouverture : ceux qui appellent l'API (domaines, iCal,
// import) ne chargent rien tant qu'on ne les ouvre pas.
const hasOpened = ref(isOpen.value)
watch(isOpen, (open) => {
  if (open) hasOpened.value = true
})
</script>

<template>
  <div
    :id="domId"
    class="editor-section"
    :class="{ 'is-collapsible': Boolean(sections), 'is-open': isOpen }"
    :data-section="props.section"
  >
    <h3
      v-if="sections"
      class="head"
    >
      <button
        type="button"
        :aria-expanded="isOpen"
        :aria-controls="bodyId"
        @click="sections.toggle(props.section)"
      >
        <span class="text">
          <span class="title">{{ label }}</span>
          <span
            v-if="summary"
            class="summary"
          >{{ summary }}</span>
        </span>
        <span
          v-if="isTodo"
          class="todo"
        >{{ editorStatic.sidebar.completion.todo }}</span>
        <ChevronDown
          class="chevron"
          :size="18"
          aria-hidden="true"
        />
      </button>
    </h3>

    <div
      v-show="isOpen"
      :id="bodyId"
      class="panel"
    >
      <slot v-if="hasOpened" />
    </div>
  </div>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/EditorSection.vue */
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/animations' as animations;

.editor-section {
  min-width: 0;
  // L'ouverture d'une section la ramène en haut de la colonne, sous cette marge.
  scroll-margin-top: var(--editor-section-scroll-margin, 0px);

  &.is-collapsible {
    border-radius: borders.$rounded-md;
    border: 1px solid rgba($secondary, 0.06);
    background: $accent;

    > .head {
      margin: 0;

      > button {
        width: 100%;
        min-height: 3.5rem;
        padding: var(--layout-gap-sm) var(--layout-gap-md);
        display: flex;
        align-items: center;
        gap: var(--layout-gap-sm);

        border: 0;
        border-radius: inherit;
        background: none;
        color: $secondary;
        text-align: left;
        cursor: pointer;
        @include animations.transition(animations.$duration-fast, animations.$ease-out, background-color);

        @include on-hover {
          background: rgba($secondary, 0.03);
        }

        &:focus-visible {
          outline: 2px solid $secondary;
          outline-offset: -2px;
        }

        > .text {
          flex: 1 1 auto;
          min-width: 0;
          display: flex;
          flex-direction: column;

          > .title {
            @include base-text($bold: true);
          }

          > .summary {
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            @include little-text(rgba($secondary-text, 0.72), $thin: false);
          }
        }

        > .todo {
          flex: 0 0 auto;
          padding: 0 var(--layout-gap-xs);
          border-radius: borders.$rounded;
          background: rgba($progressing, 0.22);
          @include little-text($secondary, $bold: true);

          &::first-letter {
            text-transform: uppercase;
          }
        }

        > .chevron {
          flex: 0 0 auto;
          color: rgba($secondary, 0.55);
          @include animations.transition(animations.$duration-fast, animations.$ease-out, transform);
        }
      }
    }

    &.is-open > .head > button {
      // Section ouverte : le résumé ferait doublon avec le contenu juste dessous.
      > .text > .summary {
        display: none;
      }

      > .chevron {
        transform: rotate(180deg);
      }
    }

    // Le panneau perd son propre cadre : la section est déjà la carte, et son nom est dans l'en-tête.
    > .panel {
      > * {
        padding: 0 var(--layout-gap-md) var(--layout-gap-md);
        border: 0;
        border-radius: 0;
        background: none;
      }

      h3 {
        display: none;
      }
    }
  }
}
</style>
