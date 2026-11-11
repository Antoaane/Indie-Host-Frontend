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
  /** Ouvre le réglage de visibilité de la page. */
  (e: 'open-visibility', listingId: string): void
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

const summary = computed(() => {
  const total = props.childrenCount
  const presented = total
    ? `${total} logement${total > 1 ? 's' : ''}`
    : 'aucun logement pour le moment'
  return props.hostname ? `${props.hostname} · ${presented}` : presented
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
      :aria-label="`Modifier la page principale ${title}`"
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
        <span class="summary">{{ summary }}</span>
      </span>
    </div>

    <div class="actions">
      <button
        type="button"
        class="status"
        :class="statusTone"
        title="Modifier la visibilité de la page"
        @click="emit('open-visibility', props.hub.listingId)"
      >
        <span
          class="dot"
          aria-hidden="true"
        />
        {{ statusLabel }}
      </button>

      <div
        v-if="props.canTransfer"
        class="transfer"
      >
        <button
          type="button"
          @click="emit('transfer', props.hub.listingId)"
        >
          Transférer
        </button>
      </div>

      <div
        v-if="props.canPreview !== false"
        class="preview"
      >
        <button
          type="button"
          @click="emit('preview', props.hub.listingId)"
        >
          Voir l’aperçu
          <Eye
            :size="18"
            aria-hidden="true"
          />
        </button>
      </div>

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
    border-radius: borders.$rounded-md;
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
      border-radius: borders.$rounded-md;
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

      > .summary {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        @include little-text(rgba($secondary-text, 0.72), $thin: false);
      }
    }
  }

  > .actions {
    flex: 0 0 auto;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--layout-gap-xs);

    > .status {
      min-height: 2.25rem;
      padding: 0 var(--layout-gap-sm);
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;

      border: 1px solid rgba($secondary, 0.1);
      border-radius: borders.$rounded;
      background: $accent;
      cursor: pointer;
      @include little-text($secondary, $thin: false);
      @include animations.transition(animations.$duration-fast, animations.$ease-out, border-color);
      @include animations.press();

      @include on-hover {
        border-color: rgba($secondary, 0.3);
      }

      &:focus-visible {
        outline: 2px solid $secondary;
        outline-offset: 2px;
      }

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

    > .transfer {
      @include buttons.primary($theme: white, $little: true);
    }

    > .preview {
      @include buttons.primary($theme: white);
    }

    // Action principale du bandeau : ouvrir la page pour la modifier dessus.
    > .edit {
      @include buttons.primary($theme: black);
    }
  }
}
</style>
