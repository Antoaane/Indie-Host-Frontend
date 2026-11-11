<!-- File: src/views/ListingHub/themed/PageEditBar.vue -->

<!-- Commandes d'édition de la page de présentation, côté IndieHost (pas dans le thème de l'hôte) :
     un seul bouton crayon tant qu'on regarde la page, puis une barre en bas avec le choix du thème
     et « Terminé ». Voir `docs/editeur-de-page.md`. -->

<script setup lang="ts">
import { ArrowLeft, Check, Pencil, RotateCw, Undo2 } from 'lucide-vue-next'

import { PAGE_THEMES, type PageThemeId } from '@/domain/listings/pageThemes'

defineProps<{
  editing: boolean
  themeId: PageThemeId
  /** Retour après une modification (« Enregistré »), annoncé aux lecteurs d'écran. */
  status?: string
  /** Vrai juste après une suppression : la barre propose de la défaire. */
  canUndo?: boolean
  /** Vrai après un enregistrement raté : la barre propose de le relancer. */
  canRetry?: boolean
  /** Thème conseillé d'après le lieu des logements : il porte une mention dans la liste. */
  suggestedThemeId?: PageThemeId | null
  /** Libellé du retour au tableau de bord, montré hors édition à côté du crayon. Absent : pas de retour. */
  backLabel?: string
}>()

const emit = defineEmits<{
  (e: 'start'): void
  (e: 'finish'): void
  (e: 'undo'): void
  (e: 'retry'): void
  (e: 'back'): void
  (e: 'select-theme', id: PageThemeId): void
}>()
</script>

<template>
  <div class="page-edit-bar">
    <template v-if="!editing">
      <div
        v-if="backLabel"
        class="back"
      >
        <button
          type="button"
          @click="emit('back')"
        >
          <ArrowLeft
            :size="18"
            aria-hidden="true"
          />
          <span class="label">{{ backLabel }}</span>
        </button>
      </div>

      <div class="start">
        <button
          type="button"
          @click="emit('start')"
        >
          <Pencil
            :size="20"
            aria-hidden="true"
          />
          <span class="label">Modifier ma page</span>
        </button>
      </div>
    </template>

    <div
      v-else
      class="bar"
      role="toolbar"
      aria-label="Modification de la page"
    >
      <p class="hint">
        Cliquez sur un texte ou une photo pour le modifier, sur « + » pour ajouter une section.
        <span
          class="status"
          role="status"
          aria-live="polite"
        >{{ status ?? '' }}</span>
        <button
          v-if="canUndo"
          type="button"
          class="undo"
          @click="emit('undo')"
        >
          <Undo2
            :size="14"
            aria-hidden="true"
          />
          Annuler
        </button>
        <button
          v-if="canRetry"
          type="button"
          class="undo"
          @click="emit('retry')"
        >
          <RotateCw
            :size="14"
            aria-hidden="true"
          />
          Réessayer
        </button>
      </p>

      <div
        class="themes"
        role="radiogroup"
        aria-label="Thème de la page"
      >
        <button
          v-for="theme in PAGE_THEMES"
          :key="theme.id"
          type="button"
          role="radio"
          class="theme"
          :class="{ 'is-selected': theme.id === themeId }"
          :aria-checked="theme.id === themeId"
          :title="theme.description"
          @click="emit('select-theme', theme.id)"
        >
          <span
            class="swatch"
            :style="{
              background: theme.colors.bg,
              color: theme.colors.ink,
              fontFamily: theme.fonts.display,
            }"
            aria-hidden="true"
          >
            Aa
            <span
              class="dot"
              :style="{ background: theme.colors.accent }"
            />
          </span>
          <span class="name">{{ theme.name }}</span>
          <span
            v-if="theme.id === suggestedThemeId"
            class="suggested"
          >Conseillé</span>
        </button>
      </div>

      <div class="done">
        <button
          type="button"
          @click="emit('finish')"
        >
          <Check
            :size="18"
            aria-hidden="true"
          />
          Terminé
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
/* File: src/views/ListingHub/themed/PageEditBar.vue */
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/animations' as animations;
@use '@/styles/components/buttons' as buttons;

.page-edit-bar {
  --ui-edit-bar-offset: max(var(--layout-gap), env(safe-area-inset-bottom));

  position: fixed;
  inset: auto 0 0;
  z-index: 60;
  display: flex;
  // Sur un écran très étroit, « Mes annonces » passe au-dessus du crayon au lieu de déborder.
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--layout-gap-sm);
  padding: 0 var(--layout-gap) var(--ui-edit-bar-offset);
  pointer-events: none;

  // Retour au tableau de bord, à côté du crayon tant qu'on regarde la page.
  > .back {
    pointer-events: auto;
    @include buttons.primary($theme: white, $deep: true);

    > button {
      border-radius: borders.$rounded;
    }
  }

  // Bouton d'entrée : rond avec son libellé, toujours au même endroit.
  > .start {
    pointer-events: auto;
    @include buttons.primary($theme: black, $deep: true);

    > button {
      border-radius: borders.$rounded;
    }
  }

  > .bar {
    pointer-events: auto;
    width: 100%;
    margin-inline: auto;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--layout-gap-sm) var(--layout-gap);
    padding: var(--layout-gap-sm) var(--layout-gap-md);
    border-radius: borders.$rounded-lg;
    border: 1px solid rgba($secondary, 0.08);
    background: $accent;
    @include big-shadow();
    @include container($max: lg);

    > .hint {
      margin: 0;
      flex: 1 1 0;
      min-width: 0;
      @include little-text($thin: false);
      color: rgba($secondary, 0.72);

      > .status {
        margin-left: var(--layout-gap-xs);
        color: $secondary;
        @include little-text($bold: true);
      }

      > .undo {
        display: inline-flex;
        align-items: center;
        gap: var(--layout-gap-2xs);
        margin-left: var(--layout-gap-xs);
        padding: 0;
        border: 0;
        background: none;
        text-decoration: underline;
        cursor: pointer;
        @include little-text($bold: true);

        &:focus-visible {
          outline: 2px solid $secondary;
          outline-offset: 2px;
        }
      }
    }

    // Téléphone : consigne et « Terminé » sur la première ligne, les trois thèmes sur toute la largeur
    // en dessous. À partir de md, tout tient sur une ligne dans l'ordre consigne, thèmes, « Terminé ».
    > .themes {
      order: 1;
      flex: 1 1 100%;
      display: flex;
      gap: var(--layout-gap-xs);

      @include min-width(md) {
        order: 0;
        flex: 0 0 auto;
      }

      > .theme {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--layout-gap-2xs);
        flex: 1 1 0;
        min-width: 3.75rem;
        padding: var(--layout-gap-xs);
        border: 1px solid transparent;
        border-radius: borders.$rounded-md;
        background: none;
        cursor: pointer;
        @include animations.transition();
        @include animations.press();

        @include on-hover {
          background: rgba($secondary, 0.05);
        }

        &:focus-visible {
          outline: 2px solid $secondary;
          outline-offset: 2px;
        }

        &.is-selected {
          border-color: $secondary;
          background: rgba($secondary, 0.05);
        }

        > .swatch {
          position: relative;
          display: grid;
          place-items: center;
          width: 3rem;
          height: 2.25rem;
          border-radius: borders.$rounded-sm;
          border: 1px solid rgba($secondary, 0.12);
          font-size: 1.25rem;
          line-height: 1;

          > .dot {
            position: absolute;
            right: 0.3rem;
            bottom: 0.3rem;
            width: 0.5rem;
            height: 0.5rem;
            border-radius: borders.$rounded;
          }
        }

        > .name {
          @include little-text($thin: false);
        }

        // Mention du thème conseillé pour le lieu : une pastille sur le coin de la vignette.
        > .suggested {
          position: absolute;
          top: calc(var(--layout-gap-xs) * -1);
          right: calc(var(--layout-gap-xs) * -1);
          padding: 0 var(--layout-gap-xs);
          border-radius: borders.$rounded;
          background: $secondary;
          @include little-text($color: $accent, $bold: true);
        }
      }
    }

    > .done {
      @include buttons.primary($theme: black);
    }
  }
}
</style>
