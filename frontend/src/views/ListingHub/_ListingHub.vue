<!-- File: src/views/ListingHub/_ListingHub.vue -->

<!-- Page principale d'un hôte : son domaine présente tous ses logements rattachés.
     Elle est rendue par la page à thème (`themed/ThemedHubPage.vue`) ; ce composant fait le lien
     avec les données réelles : contenu de l'annonce mère, logements rattachés, thème.
     Conception et décisions : `docs/editeur-de-page.md`. -->

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { fetchHubPublicPage, type ListingHubChildCard } from '@/domain/api/listingHubs'
import {
  readPageThemeId,
  resolvePageTheme,
  suggestPageThemeId,
  type HubPageContent,
  type HubPageListing,
  type PageSection,
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

// Réglages de page enregistrés dans l'annonce (`core.page`). Tout y est facultatif.
const pageSettings = computed<Record<string, unknown>>(() => {
  const value = (props.rawListing.core as Record<string, unknown> | null | undefined)?.page
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
})

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

// La description vient de l'éditeur riche : on garde les paragraphes, pas la mise en forme.
function htmlToPlainText(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, '’')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const images = computed(() => {
  const list = Array.isArray(props.rawListing.medias?.images) ? props.rawListing.medias.images : []
  return list
    .map((image) => (typeof image?.src === 'string' ? image.src.trim() : ''))
    .filter(Boolean)
})

const hostName = computed(() => {
  const host = props.rawListing.host as Record<string, unknown> | null | undefined
  for (const value of [host?.displayName, host?.name, host?.pseudo, host?.firstName]) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
})

// Sans lieu saisi par l'hôte, celui des logements s'ils sont tous au même endroit.
const location = computed(() => {
  const saved = readText(pageSettings.value.location)
  if (saved) return saved

  const places = new Set(
    children.value
      .filter((child) => child.city)
      .map((child) => (child.region ? `${child.city}, ${child.region}` : `${child.city}`)),
  )
  return places.size === 1 ? [...places][0] ?? '' : ''
})

const content = computed<HubPageContent>(() => {
  const sections: PageSection[] = []
  const description = htmlToPlainText(props.rawListing.core?.description)
  const secondImage = images.value[1] ?? null

  if (description || secondImage) {
    sections.push({ id: 'presentation', type: 'text-image', title: '', text: description, imageSrc: secondImage })
  }
  sections.push({
    id: 'logements',
    type: 'listings',
    title: children.value.length > 1 ? 'Nos logements' : 'Notre logement',
  })

  return {
    title: readText(props.rawListing.core?.title) || 'Nos logements',
    tagline: readText(pageSettings.value.tagline),
    location: location.value,
    coverSrc: images.value[0] ?? null,
    hostName: hostName.value,
    sections,
  }
})

function formatCity(child: ListingHubChildCard): string {
  if (!child.city) return ''
  return child.region ? `${child.city}, ${child.region}` : child.city
}

const listings = computed<HubPageListing[]>(() => children.value.map((child) => ({
  id: child.listingId,
  title: child.title,
  city: formatCity(child),
  guestCapacity: child.guestCapacity,
  pricePerNight: child.pricePerNight,
  coverSrc: child.coverSrc,
  href: child.publicPath,
  setting: child.setting,
  note: child.status === 'blocked' ? 'Réservations momentanément fermées' : null,
})))

// Le thème choisi par l'hôte prime ; sinon il suit le lieu des logements rattachés (mer : Rivage,
// terres : Maison), et le thème par défaut quand aucun logement n'a d'adresse.
const theme = computed(() => resolvePageTheme(
  readPageThemeId(pageSettings.value.theme) ?? suggestPageThemeId(placeSettings.value),
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
