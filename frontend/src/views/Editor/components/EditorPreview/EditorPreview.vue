<!-- File: src/views/Editor/components/EditorPreview/EditorPreview.vue -->

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import { ArrowLeft, ExternalLink } from 'lucide-vue-next'
import ListingView from '@/views/ListingView/_ListingView.vue'
import ListingHubView from '@/views/ListingHub/_ListingHub.vue'
import type { RawListingBundle } from '@/domain/listings/types'
import { buildListingSlug, isTransientListingId } from '@/domain/listings/slug'
import { fetchListingDomain } from '@/domain/api/listingDomains'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import type { ListingViewportMode } from '@/views/ListingView/composables/useListingViewport'

const props = defineProps<{
  rawListing: RawListingBundle | null
  listingId?: string | null
  domainRevision?: number
  isShowed: boolean
  isLoading?: boolean
  displayMode?: ListingViewportMode | null
}>()
const emit = defineEmits<{
  (e: 'back'): void
}>()

const wrapper = ref<HTMLElement | null>(null)
const aspectRatio = ref<{ width: number; height: number } | null>(null)
let wrapperResizeObserver: ResizeObserver | null = null
const previewContent = editorStatic.preview
const previewActions = editorStatic.actions
// Adresse publique (sous-domaine / domaine personnalisé) de l'annonce affichée, lue à la demande.
const publicDomainUrl = ref<string | null>(null)
let publicDomainResolvedFor: string | null = null
let publicDomainRequestId = 0
// Page principale : même rendu que la page publique (_Listing.vue), pas une fiche logement.
const isHubListing = computed(() => props.rawListing?.core?.kind === 'hub')
const publicListingSlug = computed(() => {
  const fromSelection = typeof props.listingId === 'string' ? props.listingId.trim() : ''
  const fromCore = typeof props.rawListing?.core?.id === 'string' ? props.rawListing.core.id.trim() : ''
  const listingId = fromSelection || fromCore
  if (!listingId || isTransientListingId(listingId)) return null

  return buildListingSlug({
    existingSlug: props.rawListing?.core?.slug,
    title: props.rawListing?.core?.title,
    listingId,
  })
})

const resolvedListingId = computed(() => {
  const fromSelection = typeof props.listingId === 'string' ? props.listingId.trim() : ''
  const fromCore = typeof props.rawListing?.core?.id === 'string' ? props.rawListing.core.id.trim() : ''
  const listingId = fromSelection || fromCore
  if (!listingId || isTransientListingId(listingId)) return null
  return listingId
})

// Lien « voir en ligne » : adresse publique si elle est connue, sinon la route par slug.
const publicListingHref = computed(() => {
  if (!resolvedListingId.value || !publicListingSlug.value) return null
  return publicDomainUrl.value ?? `/${publicListingSlug.value}`
})

// Le domaine n'est lu que lorsque l'aperçu est affiché : au chargement de l'éditeur il est caché,
// et cette lecture (relancée à chaque changement de titre, qui modifie le slug) retardait le
// premier affichage. Une fois lue pour une annonce et une révision de domaine, elle n'est pas relue.
function resolvePublicDomainUrl() {
  const listingId = resolvedListingId.value
  const marker = listingId ? `${listingId}#${props.domainRevision ?? 0}` : null

  if (marker !== publicDomainResolvedFor) {
    publicDomainUrl.value = null
    publicDomainResolvedFor = null
  }

  if (!listingId || !marker || !props.isShowed) return

  publicDomainResolvedFor = marker
  const requestId = ++publicDomainRequestId
  fetchListingDomain(listingId)
    .then((domain) => {
      if (requestId !== publicDomainRequestId) return
      publicDomainUrl.value = domain.publicUrl ?? null
    })
    .catch(() => {
      // Fallback conservé: route slug standard si le domaine n'est pas disponible.
      if (requestId === publicDomainRequestId) publicDomainResolvedFor = null
    })
}

function updateScale() {
  const container = wrapper.value

  if (container) {
    aspectRatio.value = {
      width: container?.clientWidth,
      height: container?.clientHeight,
    }
  }
}

watch(
  [() => props.isShowed, () => props.rawListing],
  async ([isShowed, rawListing]) => {
    // Important: wrapper n'existe que si rawListing est non-null.
    if (!isShowed || !rawListing) return
    await nextTick()
    updateScale()
  },
  { immediate: true },
)

watch(
  [resolvedListingId, () => props.domainRevision, () => props.isShowed],
  () => {
    resolvePublicDomainUrl()
  },
  { immediate: true },
)

watch(
  wrapper,
  (element) => {
    wrapperResizeObserver?.disconnect()
    wrapperResizeObserver = null

    if (!element || typeof ResizeObserver === 'undefined') return

    wrapperResizeObserver = new ResizeObserver(() => {
      updateScale()
    })
    wrapperResizeObserver.observe(element)

    updateScale()
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('resize', updateScale)
  updateScale()
})

onBeforeUnmount(() => {
  wrapperResizeObserver?.disconnect()
  wrapperResizeObserver = null
  window.removeEventListener('resize', updateScale)
})
</script>

<template>
  <section class="editor-preview">
    <div class="toolbar">
      <div class="back-to-listings">
        <button
          type="button"
          :aria-label="previewActions.backToListings"
          :title="previewActions.backToListings"
          @click="emit('back')"
        >
          <ArrowLeft :size="18" />
        </button>
      </div>

      <div class="show-online">
        <a
          v-if="props.rawListing && publicListingHref"
          :href="publicListingHref"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="editorStatic.listings.externalLink"
          :title="editorStatic.listings.externalLink"
          @click.stop
          @pointerdown.stop
        >
          <ExternalLink :size="18" />
        </a>
      </div>
    </div>

    <div
      v-if="props.rawListing"
      class="content"
      :class="{ 'is-hub': isHubListing }"
      ref="wrapper"
    >
      <ListingHubView
        v-if="isHubListing"
        :key="`hub-${props.rawListing.core?.id ?? 'hub'}`"
        :rawListing="props.rawListing"
      />
      <ListingView
        v-else-if="aspectRatio"
        :aspect="aspectRatio"
        :rawListing="props.rawListing"
        :forcedViewportMode="props.displayMode ?? undefined"
      />
    </div>

    <div
      v-else
      class="empty"
    >
      <div class="skeleton">
        {{ props.isLoading ? previewContent.loading : previewContent.empty }}
      </div>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/effects' as effects;
@use '@/styles/variables/borders' as borders;
@use '@/styles/components/buttons' as buttons;

.editor-preview {
  position: relative;
  height: 100%;
  min-height: 0;

  // background-color: $secondary;
  border-radius: borders.$rounded-xxl;
  overflow: hidden;

  // box-shadow: 0px 0px 20px 0px rgba($secondary, 0.3);

  .toolbar {
    position: absolute;
    top: 1.75rem;
    left: 1.75rem;
    z-index: 9;

    display: flex;
    gap: var(--layout-gap-sm);

    > .back-to-listings {
      button {
        @include buttons.low-btn($icon-only: true);
      }
    }

    > .show-online {
      a {
        @include buttons.low-btn($icon-only: true);
      }
    }
  }

  > .content {
    height: 100%;
    min-height: 0;
    overflow: hidden;
    position: relative;

    &.is-hub {
      overflow-y: auto;
      overscroll-behavior: contain;
      background-color: $background;
    }
  }

  > .empty {
    height: 100%;
    display: grid;
    place-items: center;
    padding: var(--layout-gap-md);
    color: rgba($secondary, 0.7);
  }
}
</style>
