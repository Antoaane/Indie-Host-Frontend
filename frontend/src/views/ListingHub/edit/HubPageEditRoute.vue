<!-- File: src/views/ListingHub/edit/HubPageEditRoute.vue -->

<!-- Mode édition de la page de présentation, depuis le tableau de bord (`/dashboard/page/:listingId`).
     L'hôte voit sa page telle qu'un voyageur la voit et la modifie dessus : textes, photos, thème,
     sections. Chaque modification est enregistrée et en ligne aussitôt.
     L'édition passe par le tableau de bord parce qu'un domaine personnalisé n'a pas de session de
     connexion : la page publique ne peut pas reconnaître son propriétaire.
     Conception et décisions : docs/editeur-de-page.md. -->

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'

import { uploadGalleryImageToImageKit } from '@/domain/api/imagekit'
import {
  assertCanEditHubPage,
  fetchHubPublicPage,
  saveHubPage,
  type ListingHubChildCard,
} from '@/domain/api/listingHubs'
import { getListingsController } from '@/domain/listings/controller'
import {
  buildHubPageContent,
  resolveSharedLocation,
  toHubPageListings,
  withoutDefaultListingsTitle,
} from '@/domain/listings/hubPageContent'
import {
  resolvePageTheme,
  suggestPageThemeId,
  type HubPageContent,
  type PageThemeId,
  type PlaceSetting,
} from '@/domain/listings/pageThemes'
import LegalLinksCompact from '@/components/layouts/LegalLinksCompact.vue'
import { clearListingDraft, clearListingPublishedSnapshot } from '@/views/Editor/utils/fetchListingDraft'
import { useHubPageEditing, type HubPageSnapshot } from '@/views/ListingHub/edit/useHubPageEditing'
import PageEditBar from '@/views/ListingHub/themed/PageEditBar.vue'
import ThemedHubPage from '@/views/ListingHub/themed/ThemedHubPage.vue'

const route = useRoute()
const router = useRouter()
const controller = getListingsController()

function readParam(value: unknown): string {
  if (Array.isArray(value)) return readParam(value[0])
  return typeof value === 'string' ? value.trim() : ''
}

const listingId = computed(() => readParam(route.params.listingId))
// Un admin qui modifie la page d'un client revient à l'éditeur de ce client.
const ownerId = computed(() => readParam(route.query.owner))

const isLoading = ref(true)
const loadError = ref<string | null>(null)
const editing = ref(true)

const content = ref<HubPageContent>({
  title: '',
  tagline: '',
  location: '',
  coverSrc: null,
  coverAlt: '',
  hostName: '',
  sections: [],
  footer: { name: '', text: '', email: '', phone: '' },
})
const themeId = ref<PageThemeId | null>(null)
const children = ref<ListingHubChildCard[]>([])
const placeSettings = ref<PlaceSetting[]>([])

const listings = computed(() => toHubPageListings(children.value))
const fallbackLocation = computed(() => resolveSharedLocation(children.value))
const suggestedThemeId = computed(() => suggestPageThemeId(placeSettings.value))
const theme = computed(() => resolvePageTheme(themeId.value ?? suggestedThemeId.value))

async function save(snapshot: HubPageSnapshot) {
  await saveHubPage(listingId.value, {
    title: snapshot.title,
    ...(snapshot.coverSrc ? { coverSrc: snapshot.coverSrc } : {}),
    page: {
      theme: snapshot.themeId,
      tagline: snapshot.tagline,
      // Un lieu laissé à la proposition par défaut n'est pas figé : il continue de suivre les logements.
      location: snapshot.location === fallbackLocation.value ? '' : snapshot.location,
      sections: withoutDefaultListingsTitle(snapshot.sections),
      footer: snapshot.footer,
    },
  })

  // L'éditeur garde une copie de l'annonce dans le navigateur : sans ce nettoyage, il rouvrirait
  // l'ancien titre et l'ancienne photo, et « Appliquer » les remettrait en ligne.
  clearListingDraft(listingId.value)
  clearListingPublishedSnapshot(listingId.value)
}

async function uploadImage(file: File): Promise<string> {
  const uploaded = await uploadGalleryImageToImageKit(file, { listingId: listingId.value, allowUnpublished: true })
  return uploaded.url
}

const page = useHubPageEditing({ content, themeId, save, uploadImage })

async function load() {
  isLoading.value = true
  loadError.value = null

  if (!listingId.value) {
    loadError.value = 'Page introuvable.'
    isLoading.value = false
    return
  }

  try {
    // D'abord le droit de modifier : un compte qui n'est pas propriétaire s'arrête ici.
    await assertCanEditHubPage(listingId.value)
    const [bundle, publicPage] = await Promise.all([
      controller.fetchListingBundle(listingId.value),
      fetchHubPublicPage(listingId.value),
    ])

    children.value = publicPage.children
    placeSettings.value = publicPage.placeSettings

    const built = buildHubPageContent(bundle, {
      listingsCount: publicPage.children.length,
      fallbackLocation: resolveSharedLocation(publicPage.children),
    })
    content.value = built.content
    themeId.value = built.settings.themeId
  } catch (error) {
    loadError.value = error instanceof Error && error.message.trim()
      ? error.message.trim()
      : 'Impossible de charger votre page. Rechargez-la dans un instant.'
  } finally {
    isLoading.value = false
  }
}

function goBack() {
  const query = listingId.value ? { listingId: listingId.value } : undefined
  void router.push(ownerId.value
    ? { name: 'editor-user', params: { userId: ownerId.value }, query }
    : { name: 'editor', query })
}

// Fermeture de l'onglet pendant un enregistrement : le navigateur demande confirmation.
function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!page.hasUnsavedChanges.value) return
  event.preventDefault()
}

// Changement de page dans le site : on laisse partir l'enregistrement en cours avant de quitter.
onBeforeRouteLeave(async () => {
  await page.flush()
})

onMounted(() => {
  window.addEventListener('beforeunload', onBeforeUnload)
  void load()
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
})
</script>

<template>
  <main class="hub-page-edit">
    <p
      v-if="isLoading"
      class="state"
    >
      Chargement de votre page…
    </p>

    <div
      v-else-if="loadError"
      class="state"
      role="alert"
    >
      <p>{{ loadError }}</p>
      <div class="cta">
        <button
          type="button"
          @click="goBack"
        >
          Retour à mes annonces
        </button>
      </div>
    </div>

    <template v-else>
      <ThemedHubPage
        :theme="theme"
        :content="content"
        :listings="listings"
        :editing="editing"
        :listings-message="listings.length ? null : 'Aucun logement en ligne pour le moment. Rattachez vos logements depuis « Mes annonces ».'"
        @update="page.onUpdate"
        @update-footer="page.onUpdateFooter"
        @update-section="page.onUpdateSection"
        @add-section="page.onAddSection"
        @remove-section="page.onRemoveSection"
        @pick-image="page.onPickImage"
      >
        <template #footer>
          <LegalLinksCompact
            :owner="content.footer.name"
            :show-contact="!content.footer.email && !content.footer.phone"
          />
        </template>
      </ThemedHubPage>

      <PageEditBar
        :editing="editing"
        :theme-id="theme.id"
        :suggested-theme-id="placeSettings.length ? suggestedThemeId : null"
        :status="page.status.value"
        :can-undo="page.canUndo.value"
        :can-retry="page.canRetry.value"
        back-label="Mes annonces"
        @start="editing = true"
        @finish="editing = false"
        @undo="page.onUndo"
        @retry="page.retry"
        @back="goBack"
        @select-theme="page.selectTheme"
      />
    </template>
  </main>
</template>

<style lang="scss">
/* File: src/views/ListingHub/edit/HubPageEditRoute.vue */
@use '@/styles/variables/globals' as *;
@use '@/styles/components/buttons' as buttons;

.hub-page-edit {
  // Chargement et erreur : avant que la page (et son thème) ne s'affiche.
  > .state {
    min-height: 100dvh;
    margin: 0;
    padding: var(--layout-gap);
    display: grid;
    place-content: center;
    justify-items: center;
    gap: var(--layout-gap);
    text-align: center;
    @include base-text();

    > p {
      margin: 0;
      @include base-text();
    }

    > .cta {
      @include buttons.primary($theme: black);
    }
  }
}
</style>
