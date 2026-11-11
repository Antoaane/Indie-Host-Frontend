<!-- File: src/views/ListingHub/_ListingHub.vue -->

<!-- Page principale d'un hôte : son domaine présente tous ses logements rattachés.
     Elle est rendue par la page à thème (`themed/ThemedHubPage.vue`) ; ce composant fait le lien
     avec les données réelles : contenu de l'annonce mère, logements rattachés, thème.
     Conception et décisions : `docs/editeur-de-page.md`. -->

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

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

watch(hubId, () => { void loadPage() })
onMounted(() => { void loadPage() })
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
    </template>
  </ThemedHubPage>
</template>
