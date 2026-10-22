<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/HubChildrenPanel.vue -->

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import { fetchHubChildrenForOwner, setListingParent, type ListingHubChildCard } from '@/domain/api/listingHubs'
import { editorStatic } from '@/views/Editor/utils/editorContent'

const props = defineProps<{
  listingId: string
}>()

const emit = defineEmits<{
  (e: 'select', listingId: string): void
}>()

const content = {
  title: 'Logements présentés',
  subtitle: 'Les annonces rattachées à cette page principale. Seules les annonces en ligne apparaissent aux visiteurs.',
  empty: 'Aucun logement rattaché. Ouvrez une annonce et choisissez cette page dans son panneau « Page principale ».',
  detach: 'Détacher',
  open: 'Ouvrir',
}

const statusLabels = editorStatic.listings.status as Record<string, string>

const children = ref<ListingHubChildCard[]>([])
const isLoading = ref(false)
const detachingId = ref<string | null>(null)
const errorMessage = ref<string | null>(null)

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message.trim()
  }
  return fallback
}

async function load() {
  if (!props.listingId.trim()) return
  isLoading.value = true
  errorMessage.value = null
  try {
    children.value = await fetchHubChildrenForOwner(props.listingId)
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error, 'Impossible de charger les logements rattachés.')
  } finally {
    isLoading.value = false
  }
}

async function detach(child: ListingHubChildCard) {
  if (detachingId.value) return
  detachingId.value = child.listingId
  errorMessage.value = null
  try {
    await setListingParent(child.listingId, null)
    children.value = children.value.filter((item) => item.listingId !== child.listingId)
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error, 'Impossible de détacher ce logement.')
  } finally {
    detachingId.value = null
  }
}

function statusLabel(status: string): string {
  return statusLabels[status] ?? status
}

watch(() => props.listingId, () => { void load() })
onMounted(() => { void load() })
</script>

<template>
  <section class="editor-hub-children-panel">
    <div class="header">
      <h3>{{ content.title }}</h3>
      <p>{{ content.subtitle }}</p>
    </div>

    <div class="body">
      <p
        v-if="isLoading"
        class="meta"
      >
        Chargement...
      </p>

      <ul
        v-else-if="children.length"
        class="children"
      >
        <li
          v-for="child in children"
          :key="child.listingId"
          class="child"
        >
          <span
            class="cover"
            aria-hidden="true"
          >
            <img
              v-if="child.coverSrc"
              :src="child.coverSrc"
              alt=""
            />
          </span>
          <span class="identity">
            <strong>{{ child.title }}</strong>
            <small>{{ statusLabel(child.status) }}{{ child.city ? ` · ${child.city}` : '' }}</small>
          </span>
          <span class="actions">
            <button
              type="button"
              @click="emit('select', child.listingId)"
            >
              {{ content.open }}
            </button>
            <button
              type="button"
              :disabled="detachingId === child.listingId"
              @click="detach(child)"
            >
              {{ content.detach }}
            </button>
          </span>
        </li>
      </ul>

      <p
        v-else
        class="hint"
      >
        {{ content.empty }}
      </p>

      <p
        v-if="errorMessage"
        class="meta is-error"
        role="alert"
      >
        {{ errorMessage }}
      </p>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/components/buttons' as buttons;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-hub-children-panel {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;

    > .children {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: var(--layout-gap-xs);

      > .child {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: var(--layout-gap-sm);
        padding: var(--layout-gap-xs);
        border: 1px solid rgba($secondary, 0.1);
        border-radius: borders.$rounded-sm;

        > .cover {
          width: 3rem;
          height: 3rem;
          overflow: hidden;
          border-radius: borders.$rounded-xs;
          background: rgba($secondary, 0.06);

          > img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
        }

        > .identity {
          min-width: 0;
          display: flex;
          flex-direction: column;

          > strong {
            @include little-text($bold: true);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          > small {
            @include little-text($thin: false);
            color: rgba($secondary, 0.6);
          }
        }

        > .actions {
          display: flex;
          gap: var(--layout-gap-2xs);

          > button {
            @include buttons.low-btn($little: true, $borders: true);
          }
        }
      }
    }

    > .hint,
    > .meta {
      margin: 0;
      @include little-text($thin: false);
      color: rgba($secondary, 0.72);

      &.is-error {
        color: $bad-ink;
      }
    }
  }
}
</style>
