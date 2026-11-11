<!-- File: src/views/Editor/components/EditorSidebar/EditorSidebarNav.vue -->

<script setup lang="ts">
import { nextTick } from 'vue'
import { ArrowLeft } from 'lucide-vue-next'

import type { EditorGroupDefinition, EditorGroupId } from '@/views/Editor/components/EditorSidebar/editorSections'
import { editorStatic } from '@/views/Editor/utils/editorContent'

// Groupes de l'éditeur (onglets glissants). Les sections d'un groupe ne sont plus des puces : ce sont
// les lignes repliables de la colonne (`EditorSection.vue`), qui portent leur nom et leur résumé.
const props = defineProps<{
  groups: EditorGroupDefinition[]
  modelValue: EditorGroupId
  /** Groupes dont au moins une section reste à compléter. */
  incompleteGroups: Partial<Record<EditorGroupId, boolean>>
  showMobileBack?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: EditorGroupId): void
  (e: 'mobile-back'): void
}>()

const sidebarContent = editorStatic.sidebar
const actionsContent = editorStatic.actions

function handleGroupKeydown(event: KeyboardEvent, index: number) {
  const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
  if (!delta) return
  event.preventDefault()
  const next = props.groups[(index + delta + props.groups.length) % props.groups.length]
  if (!next) return
  emit('update:modelValue', next.id)
  nextTick(() => {
    const button = (event.currentTarget as HTMLElement | null)?.parentElement?.parentElement
      ?.querySelector<HTMLButtonElement>(`[data-group="${next.id}"]`)
    button?.focus()
  })
}
</script>

<template>
  <nav
    class="editor-sidebar-nav"
    :aria-label="sidebarContent.groupsAria"
  >
    <div class="groups-row">
      <div
        v-if="props.showMobileBack"
        class="mobile-back-shell"
      >
        <button
          type="button"
          class="mobile-back-btn"
          :aria-label="actionsContent.backToListings"
          :title="actionsContent.backToListings"
          @click="emit('mobile-back')"
        >
          <ArrowLeft :size="18" />
        </button>
      </div>

      <div
        class="groups-track"
        role="tablist"
      >
        <div
          v-for="(group, index) in props.groups"
          :key="group.id"
          class="group"
          :class="{ 'is-active': group.id === props.modelValue }"
        >
          <button
            type="button"
            role="tab"
            :data-group="group.id"
            :aria-selected="group.id === props.modelValue"
            :tabindex="group.id === props.modelValue ? 0 : -1"
            @click="emit('update:modelValue', group.id)"
            @keydown="handleGroupKeydown($event, index)"
          >
            {{ group.label }}
            <span
              v-if="props.incompleteGroups[group.id]"
              class="todo"
              :title="sidebarContent.completion.todoAria"
            >
              <span class="sr-only">({{ sidebarContent.completion.todo }})</span>
            </span>
          </button>
        </div>
      </div>
    </div>

  </nav>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/editor-sidebar-nav.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/animations' as animations;

.editor-sidebar-nav {
  width: 100%;
  min-width: 0;

  display: flex;
  flex-direction: column;
  gap: var(--layout-gap-xs);

  > .groups-row {
    display: flex;
    align-items: stretch;
    gap: var(--layout-gap-xs);

    > .mobile-back-shell {
      flex: 0 0 auto;
      width: 2.75rem;
      min-width: 2.75rem;
      display: flex;
      align-items: center;
      justify-content: center;

      > .mobile-back-btn {
        width: 100%;
        height: 100%;
        min-height: 2.75rem;

        border: 1px solid rgba($secondary, 0.1);
        border-radius: borders.$rounded-md;
        background: $accent-surface-2;
        color: rgba($secondary-text, 0.95);
        cursor: pointer;
        @include animations.transition(animations.$duration-fast);

        display: inline-flex;
        align-items: center;
        justify-content: center;
        @include animations.press();

        &:focus-visible {
          outline: 2px solid $secondary;
          outline-offset: 2px;
        }
      }
    }

    // Les groupes se partagent la largeur quand elle suffit, et défilent sinon (mobile).
    > .groups-track {
      flex: 1 1 auto;
      min-width: 0;

      display: flex;
      gap: var(--layout-gap-xs);
      overflow-x: auto;
      overscroll-behavior-x: contain;
      scrollbar-width: none;
      mask-image: linear-gradient(to right, $dark calc(100% - 1.5rem), transparent);

      &::-webkit-scrollbar {
        display: none;
      }

      > .group {
        flex: 1 0 auto;
        min-width: 0;

        > button {
          width: 100%;
          min-height: 2.5rem;
          padding: 0.5rem 0.8rem;

          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;

          @include little-text($thin: false);
          font-family: 'Outfit', sans-serif;
          white-space: nowrap;

          // Une section du groupe reste à compléter.
          > .todo {
            flex: 0 0 auto;
            width: 0.45rem;
            height: 0.45rem;
            border-radius: borders.$rounded;
            background: $progressing;
            box-shadow: 0 0 0 1px rgba($secondary, 0.12);
          }

          border: none;
          // Emboîté dans l'en-tête de colonne (arrondi xl, marge 0.5rem).
          border-radius: borders.inner(borders.$rounded-xl, 0.5rem);
          background: transparent;
          color: rgba($secondary-text, 0.8);
          cursor: pointer;
          @include animations.transition(animations.$duration-fast);
          @include animations.press();

          @include on-hover {
            color: $secondary-text;
            background: rgba($secondary, 0.06);
          }

          &:focus-visible {
            outline: 2px solid $secondary;
            outline-offset: 2px;
          }

          @media (pointer: coarse) {
            min-height: 2.75rem;
          }
        }

        &.is-active {
          > button {
            color: $accent;
            font-weight: 700;
            background: $secondary;
          }
        }
      }
    }
  }
}
</style>
