<!-- File: src/views/Editor/components/EditorSidebar/EditorSidebarNav.vue -->

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ArrowLeft } from 'lucide-vue-next'

import type { EditorGroupDefinition, EditorGroupId, EditorSectionId } from '@/views/Editor/components/EditorSidebar/editorSections'
import { editorStatic } from '@/views/Editor/utils/editorContent'

// Sommaire de l'éditeur : une rangée de groupes (onglets glissants) puis les sections du
// groupe ouvert, en puces défilantes ancrées sur les panneaux.
const props = defineProps<{
  groups: EditorGroupDefinition[]
  modelValue: EditorGroupId
  activeSection: EditorSectionId | null
  /** Sections encore vides d'après le brouillon. */
  incompleteSections: Partial<Record<EditorSectionId, boolean>>
  showMobileBack?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: EditorGroupId): void
  (e: 'select-section', value: EditorSectionId): void
  (e: 'mobile-back'): void
}>()

const sidebarContent = editorStatic.sidebar
const actionsContent = editorStatic.actions

const activeGroup = computed(() => props.groups.find((group) => group.id === props.modelValue) ?? props.groups[0])
const sections = computed(() => activeGroup.value?.sections ?? [])

const sectionsRef = ref<HTMLElement | null>(null)

function isSectionIncomplete(sectionId: EditorSectionId): boolean {
  return props.incompleteSections[sectionId] === true
}

// La puce active reste visible dans la rangée quand le défilement du corps la change.
// Défilement de la rangée seule : `scrollIntoView` ferait aussi défiler les ancêtres
// (sur mobile, la colonne entière glisserait pour montrer le tiroir hors écran).
function revealChip(sectionId: EditorSectionId) {
  const row = sectionsRef.value
  const chip = row?.querySelector<HTMLElement>(`[data-section-chip="${sectionId}"]`)
  if (!row || !chip) return
  const rowRect = row.getBoundingClientRect()
  const chipRect = chip.getBoundingClientRect()
  const edge = 32
  if (chipRect.left < rowRect.left + edge) {
    row.scrollLeft += chipRect.left - rowRect.left - edge
  } else if (chipRect.right > rowRect.right - edge) {
    row.scrollLeft += chipRect.right - rowRect.right + edge
  }
}

watch(
  () => props.activeSection,
  async (sectionId) => {
    if (!sectionId) return
    await nextTick()
    revealChip(sectionId)
  },
)

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
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="sections.length > 1"
      ref="sectionsRef"
      class="sections-row"
      :aria-label="sidebarContent.sectionsAria"
      role="list"
    >
      <div
        v-for="section in sections"
        :key="section.id"
        class="section"
        role="listitem"
      >
        <button
          type="button"
          :data-section-chip="section.id"
          :class="{ 'is-active': section.id === props.activeSection, 'is-todo': isSectionIncomplete(section.id) }"
          :aria-current="section.id === props.activeSection ? 'true' : undefined"
          @click="emit('select-section', section.id)"
        >
          <span class="label">{{ section.label }}</span>
          <span
            v-if="isSectionIncomplete(section.id)"
            class="todo"
            :title="sidebarContent.completion.todoAria"
          >
            <span class="sr-only">({{ sidebarContent.completion.todo }})</span>
          </span>
        </button>
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

          @include little-text($thin: false);
          font-family: 'Outfit', sans-serif;
          white-space: nowrap;

          border: none;
          border-radius: borders.$rounded-md;
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

  // Sections du groupe ouvert : rangée défilante de puces, sans barre de défilement.
  > .sections-row {
    display: flex;
    gap: var(--layout-gap-xs);
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
    padding: 0.1rem 2rem 0.2rem 0.1rem;
    margin: 0 -0.1rem;
    // Le bord droit s'estompe : la rangée continue au-delà du cadre.
    mask-image: linear-gradient(to right, $dark calc(100% - 2rem), transparent);

    &::-webkit-scrollbar {
      display: none;
    }

    > .section {
      flex: 0 0 auto;

      > button {
        min-height: 2rem;
        padding: 0.3rem 0.7rem;

        display: inline-flex;
        align-items: center;
        gap: 0.4rem;

        @include little-text(rgba($secondary-text, 0.75), $thin: false);
        white-space: nowrap;

        border: 1px solid rgba($secondary, 0.1);
        border-radius: borders.$rounded;
        background: $accent;
        cursor: pointer;
        @include animations.transition(animations.$duration-fast);
        @include animations.press();

        @include on-hover {
          color: $secondary-text;
          border-color: rgba($secondary, 0.22);
        }

        &:focus-visible {
          outline: 2px solid $secondary;
          outline-offset: 2px;
        }

        &.is-active {
          color: $secondary-text;
          font-weight: 700;
          background: $accent-surface-2;
          border-color: rgba($secondary, 0.18);
        }

        > .todo {
          width: 0.45rem;
          height: 0.45rem;
          border-radius: borders.$rounded;
          background: $progressing;
          box-shadow: 0 0 0 1px rgba($secondary, 0.12);
        }

        @media (pointer: coarse) {
          min-height: 2.75rem;
          padding-inline: 0.9rem;
        }
      }
    }
  }
}
</style>
