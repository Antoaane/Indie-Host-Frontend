<!-- File: src/views/ListingHub/_ListingHub.vue -->

<!-- Page principale d'un hôte : son domaine présente tous ses logements rattachés.
     Elle est rendue par la page à thème (`themed/ThemedHubPage.vue`) ; ce composant fait le lien
     avec les données réelles : contenu de l'annonce mère, logements rattachés, thème.
     Conception et décisions : `docs/editeur-de-page.md`. -->

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUser } from '@clerk/vue'
import { Pencil } from 'lucide-vue-next'

import { getListingsController } from '@/domain/listings/controller'
import { getPublicListingRootDomain, isListingHostname } from '@/domain/listings/publicDomain'
import { OWNER_VIEW_PARAM } from '@/views/Editor/utils/pageEditorRoute'
import { fetchHubPublicPage, type ListingHubChildCard } from '@/domain/api/listingHubs'
import { buildHubPageContent, resolveSharedLocation, toHubPageListings } from '@/domain/listings/hubPageContent'
import {
  resolvePageTheme,
  suggestPageThemeId,
  type HubPageListing,
  type PlaceSetting,
} from '@/domain/listings/pageThemes'
import type { RawListingBundle } from '@/domain/listings/types'
import LegalLinksCompact from '@/components/layouts/LegalLinksCompact.vue'
import ThemedHubPage from '@/views/ListingHub/themed/ThemedHubPage.vue'

const props = withDefaults(
  defineProps<{
    rawListing: RawListingBundle
    /** Aperçu dans l'éditeur : la page ne repeint pas le document et ne navigue pas. */
    embedded?: boolean
  }>(),
  { embedded: false },
)

const router = useRouter()

const children = ref<ListingHubChildCard[]>([])
const placeSettings = ref<PlaceSetting[]>([])
const isLoading = ref(false)
const loadError = ref<string | null>(null)

const hubId = computed(() => (props.rawListing.core?.id ?? '').trim())

// Contenu de la page : ce que l'hôte a enregistré en modifiant sa page (`core.page`), sinon la
// présentation de l'annonce (description et deuxième photo) suivie des logements.
const page = computed(() => buildHubPageContent(props.rawListing, {
  listingsCount: children.value.length,
  // Sans lieu saisi par l'hôte, celui des logements s'ils sont tous au même endroit.
  fallbackLocation: resolveSharedLocation(children.value),
}))
const content = computed(() => page.value.content)

const listings = computed(() => toHubPageListings(children.value))

// Le thème choisi par l'hôte prime ; sinon il suit le lieu des logements rattachés (mer : Rivage,
// terres : Maison), et le thème par défaut quand aucun logement n'a d'adresse.
const theme = computed(() => resolvePageTheme(
  page.value.settings.themeId ?? suggestPageThemeId(placeSettings.value),
))

const listingsMessage = computed(() => {
  if (children.value.length) return null
  if (isLoading.value) return 'Chargement des logements…'
  if (loadError.value) return loadError.value
  return 'Aucun logement en ligne pour le moment. Revenez bientôt !'
})

async function loadPage() {
  if (!hubId.value) return
  isLoading.value = true
  loadError.value = null
  try {
    const page = await fetchHubPublicPage(hubId.value)
    children.value = page.children
    placeSettings.value = page.placeSettings
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Impossible de charger les logements.'
  } finally {
    isLoading.value = false
  }
}

// Clic simple : navigation interne, sans recharger la page. Ctrl/Cmd+clic et clic molette gardent le lien natif.
function openListing(listing: HubPageListing, event: MouseEvent) {
  if (props.embedded) {
    event.preventDefault()
    return
  }
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  void router.push(listing.href)
}

// Propriétaire connecté (ou administrateur) : la page publique lui propose de la modifier. La
// session n'existe que sur indiehost.fr, pas sur un domaine relié : là, le bouton n'apparaît pas.
const { isSignedIn, user } = useUser()
const route = useRoute()
const isOwnerBySession = ref(false)
// Page ouverte depuis l'éditeur (`?proprietaire=1`) : retenu pour cet onglet, puis retiré de l'adresse
// pour qu'un lien copié ne montre pas le bouton aux voyageurs.
const isOwnerView = ref(false)
const canEditPage = computed(() => !props.embedded && (isOwnerBySession.value || isOwnerView.value))
let ownershipRequestId = 0

function ownerViewStorageKey(id: string) {
  return `indiehost:owner-view:${id}`
}

function readOwnerView() {
  const id = hubId.value
  if (props.embedded || !id || typeof window === 'undefined') return

  let remembered = false
  try {
    remembered = window.sessionStorage.getItem(ownerViewStorageKey(id)) === '1'
  } catch {
    // Stockage indisponible : le repère ne vaut que pour cet affichage.
  }

  if (OWNER_VIEW_PARAM in route.query) {
    isOwnerView.value = true
    try {
      window.sessionStorage.setItem(ownerViewStorageKey(id), '1')
    } catch {
      // Voir plus haut.
    }
    const query = { ...route.query }
    delete query[OWNER_VIEW_PARAM]
    void router.replace({ query, hash: route.hash })
    return
  }

  isOwnerView.value = remembered
}

// Sur un domaine relié ou un sous-domaine, le mode édition vit sur le site principal.
const editPageHref = computed(() => {
  if (typeof window === 'undefined' || !isListingHostname(window.location.hostname)) return null
  return `https://${getPublicListingRootDomain()}/dashboard/page/${encodeURIComponent(hubId.value)}`
})

watch(
  () => [hubId.value, Boolean(isSignedIn.value), user.value?.id ?? null] as const,
  async ([id, signedIn, userId]) => {
    const requestId = ++ownershipRequestId
    isOwnerBySession.value = false
    if (props.embedded || !id || !signedIn || !userId) return

    try {
      const owned = await getListingsController().fetchListings({ userId, includeDeleted: false })
      if (requestId !== ownershipRequestId) return
      isOwnerBySession.value = owned.some((listing) => listing.listingId === id)
    } catch (error) {
      console.warn('[ListingHub] impossible de savoir si la page vous appartient', error)
    }
  },
  { immediate: true },
)

watch(hubId, () => {
  void loadPage()
  readOwnerView()
})
onMounted(() => {
  void loadPage()
  readOwnerView()
})
</script>

<template>
  <ThemedHubPage
    :theme="theme"
    :content="content"
    :listings="listings"
    :embedded="embedded"
    :listings-message="listingsMessage"
    :listings-message-is-error="Boolean(loadError)"
    @open-listing="openListing"
  >
    <template #footer>
      <LegalLinksCompact />

      <Teleport to="body">
        <div
          v-if="canEditPage"
          class="hub-owner-edit"
        >
          <div class="action">
          <a
            v-if="editPageHref"
            :href="editPageHref"
          >
            <Pencil
              :size="18"
              aria-hidden="true"
            />
            Modifier ma page
          </a>
          <RouterLink
            v-else
            :to="{ name: 'page-editor', params: { listingId: hubId } }"
          >
            <Pencil
              :size="18"
              aria-hidden="true"
            />
            Modifier ma page
          </RouterLink>
          </div>
        </div>
      </Teleport>
    </template>
  </ThemedHubPage>
</template>

<style lang="scss">
/* File: src/views/ListingHub/_ListingHub.vue */

@use '@/styles/variables/globals' as *;
@use '@/styles/components/buttons' as buttons;

// Bouton du propriétaire, en bas à droite de sa page publique. Posé sur le document (Teleport) :
// la page à thème a ses propres couleurs et ses propres polices.
.hub-owner-edit {
  position: fixed;
  right: calc(var(--layout-gap) + var(--safe-area-right));
  bottom: calc(var(--layout-gap) + var(--safe-area-bottom));
  z-index: 50;

  // Le style de bouton est porté par une enveloppe intérieure : appliqué au bloc fixe, il en
  // remplaçait le positionnement.
  > .action {
    @include buttons.primary($theme: black);
  }
}
</style>
