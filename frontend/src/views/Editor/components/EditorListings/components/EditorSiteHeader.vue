<!-- File: src/views/Editor/components/EditorListings/components/EditorSiteHeader.vue -->

<!-- Bandeau d'une page principale dans « Mes annonces ». Ce n'est pas une carte parmi les autres : c'est
     l'en-tête du bloc qui contient ses logements, pour que le lien « cette page présente ces logements »
     se lise sans explication. Un clic sur le bandeau ouvre la page dans la colonne de gauche. -->

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Eye, LayoutGrid, Pencil } from 'lucide-vue-next'

import { normalizeListingStatus } from '@/domain/listings/status'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import type { UserListingCard } from '@/views/Editor/utils/listingApi'
import { buildPageEditorRoute, readEditorRouteUserId } from '@/views/Editor/utils/pageEditorRoute'

const props = defineProps<{
  hub: UserListingCard
  /** Logements rattachés à la page. */
  childrenCount: number
  /** Adresse publique de la page (domaine ou sous-domaine), sans le protocole. */
  hostname?: string
  isSelected?: boolean
  canPreview?: boolean
  canTransfer?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', listingId: string): void
  (e: 'preview', listingId: string): void
  (e: 'transfer', listingId: string): void
}>()

const listingContent = editorStatic.listings
const statusLabels = listingContent.status as Record<string, string>

const title = computed(() => (props.hub.title ?? '').trim() || listingContent.untitled)
const status = computed(() => normalizeListingStatus(props.hub.status) || 'draft')
// Une page principale n'a pas de réservations : « bloquée » y vaut « en ligne ».
const statusLabel = computed(() => (
  status.value === 'blocked' ? statusLabels.published : statusLabels[status.value] ?? status.value
))
const statusTone = computed(() => {
  if (status.value === 'published' || status.value === 'blocked') return 'is-online'
  if (status.value === 'paused') return 'is-paused'
  return 'is-draft'
})

// Ligne d'information : l'adresse de la page, puis ce qu'elle présente.
const details = computed(() => {
  const total = props.childrenCount
  const presented = total
    ? `${total} logement${total > 1 ? 's' : ''}`
    : 'aucun logement pour le moment'
  return [props.hostname, presented].filter(Boolean)
})

const route = useRoute()
// L'entrée principale d'une page : la modifier dessus (textes, photos, thème, sections).
const pageEditorRoute = computed(() => buildPageEditorRoute(
  props.hub.listingId,
  props.hub.ownerId ?? readEditorRouteUserId(route.params.userId),
))

function select() {
  emit('select', props.hub.listingId)
}
</script>

<template>
  <div
    class="editor-site-header"
    :class="{ 'is-selected': props.isSelected }"
  >
    <div
      class="open"
      role="button"
      tabindex="0"
      :aria-pressed="props.isSelected"
      :aria-label="`Régler la page principale ${title}`"
      @click="select"
      @keydown.enter.prevent="select"
      @keydown.space.prevent="select"
    >
      <span
        class="cover"
        aria-hidden="true"
      >
        <img
          v-if="props.hub.coverSrc"
          :src="props.hub.coverSrc"
          alt=""
          loading="lazy"
        />
        <LayoutGrid
          v-else
          :size="22"
        />
      </span>

      <span class="text">
        <span class="kind">Page principale</span>
        <span class="title">{{ title }}</span>
        <span class="details">
          <span
            class="status"
            :class="statusTone"
          >
            <span
              class="dot"
              aria-hidden="true"
            />
            {{ statusLabel }}
          </span>
          <span
            v-for="detail in details"
            :key="detail"
            class="detail"
          >{{ detail }}</span>
        </span>
      </span>
    </div>

    <div class="actions">
      <button
        v-if="props.canTransfer"
        type="button"
        class="quiet"
        @click="emit('transfer', props.hub.listingId)"
      >
        Transférer
      </button>

      <button
        v-if="props.canPreview !== false"
        type="button"
        class="quiet"
        @click="emit('preview', props.hub.listingId)"
      >
        <Eye
          :size="18"
          aria-hidden="true"
        />
        Aperçu
      </button>

      <div class="edit">
        <RouterLink :to="pageEditorRoute">
          <Pencil
            :size="18"
            aria-hidden="true"
          />
          Modifier la page
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorListings/components/EditorSiteHeader.vue */
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/animations' as animations;
@use '@/styles/components/buttons' as buttons;

.editor-site-header {
  // Une seule hauteur pour les deux actions : elles se lisent comme un groupe.
  --ui-site-header-action-height: 2.5rem;

  min-width: 0;
  padding: var(--layout-gap-sm);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--layout-gap-sm) var(--layout-gap-md);

  border-radius: borders.$rounded-lg;
  border: 1px solid rgba($secondary, 0.06);
  background: $accent;
  // Même anneau de sélection que les cartes.
  outline: 2px solid transparent;
  outline-offset: 2px;
  @include soft-shadow();
  @include animations.transition(animations.$duration-fast, animations.$ease-out, outline-color);

  &.is-selected {
    outline-color: $secondary;
  }

  > .open {
    flex: 1 1 16rem;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--layout-gap-md);
    border-radius: borders.inner(borders.$rounded-lg, var(--layout-gap-sm));
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid $secondary;
      outline-offset: 2px;
    }

    > .cover {
      flex: 0 0 auto;
      width: 5.5rem;
      aspect-ratio: 4 / 3;
      overflow: hidden;
      display: grid;
      place-items: center;
      // Emboîtée dans le bandeau.
      border-radius: borders.inner(borders.$rounded-lg, var(--layout-gap-sm));
      background: $accent-surface-2;

      > img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      > svg {
        color: rgba($secondary, 0.55);
      }
    }

    > .text {
      min-width: 0;
      display: flex;
      flex-direction: column;

      > .kind {
        @include little-text(rgba($secondary-text, 0.72), $thin: false);
      }

      > .title {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        @include h4-title($secondary);
      }

      // État, adresse et nombre de logements sur une ligne, séparés par un point médian.
      > .details {
        min-width: 0;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        column-gap: var(--layout-gap-xs);

        > .status,
        > .detail {
          @include little-text(rgba($secondary-text, 0.72), $thin: false);
        }

        > .detail::before {
          content: '·';
          margin-right: var(--layout-gap-xs);
        }

        > .status {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          color: $secondary;

          > .dot {
            width: 0.5rem;
            height: 0.5rem;
            border-radius: borders.$rounded;
            background: rgba($secondary, 0.35);
          }

          &.is-online > .dot {
            background: $good-ink;
          }

          &.is-paused > .dot {
            background: $bad;
          }
        }
      }
    }
  }

  > .actions {
    flex: 0 0 auto;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--layout-gap-xs);

    // Action secondaire : texte et icône, sans cadre. Elle ne doit pas concurrencer « Modifier la page ».
    > .quiet {
      min-height: var(--ui-site-header-action-height);
      padding: 0 var(--layout-gap-sm);
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;

      border: 0;
      border-radius: borders.inner(borders.$rounded-lg, var(--layout-gap-sm));
      background: none;
      cursor: pointer;
      @include base-text($secondary);
      @include animations.transition(animations.$duration-fast, animations.$ease-out, background-color);
      @include animations.press();

      @include on-hover {
        background: rgba($secondary, 0.06);
      }

      &:focus-visible {
        outline: 2px solid $secondary;
        outline-offset: 2px;
      }
    }

    // Action principale du bandeau : ouvrir la page pour la modifier dessus.
    > .edit {
      @include buttons.primary($theme: black);

      > a {
        min-height: var(--ui-site-header-action-height);
        border-radius: borders.inner(borders.$rounded-lg, var(--layout-gap-sm));
      }
    }
  }
}
</style>
