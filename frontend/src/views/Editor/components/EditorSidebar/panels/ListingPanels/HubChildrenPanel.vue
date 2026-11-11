<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/HubChildrenPanel.vue -->

<!-- Page principale : les logements qu'elle présente, et ceux du même hôte qu'on peut y ajouter d'un
     clic. C'est ici que se comprend le lien entre la page et ses logements, sans passer par chaque annonce. -->

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import { fetchHubChildrenForOwner, setListingParent, type ListingHubChildCard } from '@/domain/api/listingHubs'
import { editorStatic } from '@/views/Editor/utils/editorContent'

export type AttachableListing = {
  listingId: string
  title: string
  coverSrc: string | null
  status: string
}

const props = withDefaults(
  defineProps<{
    listingId: string
    /** Logements du même hôte qui ne sont rattachés à aucune page principale. */
    availableListings?: AttachableListing[]
  }>(),
  { availableListings: () => [] },
)

const emit = defineEmits<{
  (e: 'select', listingId: string): void
  /** Un logement vient d'être ajouté ou retiré : la liste des annonces est à recharger. */
  (e: 'changed'): void
}>()

const content = {
  title: 'Logements présentés',
  subtitle: 'Votre page principale présente ces logements. Chacun garde sa propre page, sous la même adresse. Seuls les logements en ligne sont montrés aux visiteurs.',
  onPage: 'Sur cette page',
  available: 'Vos autres logements',
  empty: 'Aucun logement sur cette page pour le moment.',
  noListing: 'Créez d’abord un logement avec « Nouvelle annonce », puis ajoutez-le ici.',
  attach: 'Ajouter à la page',
  attaching: 'Ajout…',
  detach: 'Retirer',
  open: 'Ouvrir',
}

const statusLabels = editorStatic.listings.status as Record<string, string>

const children = ref<ListingHubChildCard[]>([])
const isLoading = ref(false)
const busyId = ref<string | null>(null)
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
    errorMessage.value = resolveErrorMessage(error, 'Impossible de charger les logements de cette page.')
  } finally {
    isLoading.value = false
  }
}

async function detach(child: ListingHubChildCard) {
  if (busyId.value) return
  busyId.value = child.listingId
  errorMessage.value = null
  try {
    await setListingParent(child.listingId, null)
    children.value = children.value.filter((item) => item.listingId !== child.listingId)
    emit('changed')
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error, 'Impossible de retirer ce logement de la page.')
  } finally {
    busyId.value = null
  }
}

async function attach(listing: AttachableListing) {
  if (busyId.value) return
  busyId.value = listing.listingId
  errorMessage.value = null
  try {
    await setListingParent(listing.listingId, props.listingId)
    emit('changed')
    await load()
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error, 'Impossible d’ajouter ce logement à la page.')
  } finally {
    busyId.value = null
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
        Chargement…
      </p>

      <template v-else>
        <p class="label">{{ content.onPage }}</p>

        <ul
          v-if="children.length"
          class="items"
        >
          <li
            v-for="child in children"
            :key="child.listingId"
            class="item"
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
                :disabled="busyId === child.listingId"
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

        <template v-if="props.availableListings.length">
          <p class="label">{{ content.available }}</p>

          <ul class="items">
            <li
              v-for="listing in props.availableListings"
              :key="listing.listingId"
              class="item"
            >
              <span
                class="cover"
                aria-hidden="true"
              >
                <img
                  v-if="listing.coverSrc"
                  :src="listing.coverSrc"
                  alt=""
                />
              </span>
              <span class="identity">
                <strong>{{ listing.title }}</strong>
                <small>{{ statusLabel(listing.status) }}</small>
              </span>
              <span class="actions">
                <button
                  type="button"
                  :disabled="Boolean(busyId)"
                  @click="attach(listing)"
                >
                  {{ busyId === listing.listingId ? content.attaching : content.attach }}
                </button>
              </span>
            </li>
          </ul>
        </template>

        <p
          v-else-if="!children.length"
          class="hint"
        >
          {{ content.noListing }}
        </p>
      </template>

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
/* File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/HubChildrenPanel.vue */
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
    gap: var(--layout-gap-sm);

    > .label {
      margin: 0;
      @include little-text($secondary, $bold: true);
    }

    > .items {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: var(--layout-gap-xs);

      > .item {
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
