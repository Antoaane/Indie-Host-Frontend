<!-- File: src/views/ListingHub/dev/DevPageThemesRoute.vue -->

<!-- Prévisualisation des thèmes de page et du mode édition, sur du faux contenu, sans compte ni API.
     Route de développement uniquement :
       /dev/page-themes?theme=maison|rivage|nocturne   thème choisi par l'hôte
       /dev/page-themes?lieu=mer|terre                 thème appliqué d'office d'après le lieu (sans rien : pas d'adresse)
       &edit=1                                         arrivée directe en mode édition
       &photo=0                                        page sans photo d'en-tête
       &logements=0|1                                  page sans logement, ou avec un seul
       &erreur=1                                       chaque enregistrement échoue (message et « Réessayer »)
     Le mode édition est le vrai (`edit/useHubPageEditing.ts`) ; seuls l'enregistrement et l'envoi
     des photos sont simulés : rien ne quitte le navigateur, tout disparaît au rechargement. -->

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  readPageThemeId,
  resolvePageTheme,
  suggestPageThemeId,
  type HubPageContent,
  type PageThemeId,
  type PlaceSetting,
} from '@/domain/listings/pageThemes'
import LegalLinksCompact from '@/components/layouts/LegalLinksCompact.vue'
import { useHubPageEditing, type HubPageSnapshot } from '@/views/ListingHub/edit/useHubPageEditing'
import PageEditBar from '@/views/ListingHub/themed/PageEditBar.vue'
import ThemedHubPage from '@/views/ListingHub/themed/ThemedHubPage.vue'
import { buildDevPageContent, buildDevPageListings } from '@/views/ListingHub/dev/devPageContent'

// `montagne` reste accepté : pour le thème, la montagne fait partie des terres.
const PLACE_BY_QUERY: Record<string, PlaceSetting> = {
  mer: 'sea',
  terre: 'inland',
  montagne: 'inland',
}

const route = useRoute()
const router = useRouter()

const placeSetting = computed<PlaceSetting | null>(() => {
  const value = typeof route.query.lieu === 'string' ? route.query.lieu : ''
  return PLACE_BY_QUERY[value] ?? null
})
const listings = computed(() => {
  const all = buildDevPageListings(placeSetting.value)
  if (route.query.logements === '0') return []
  if (route.query.logements === '1') return all.slice(0, 1)
  return all
})

// Le choix de l'hôte prime ; sans choix, le thème suit le lieu des logements.
const suggestedThemeId = computed(() => suggestPageThemeId(listings.value.map((listing) => listing.setting)))
const chosenThemeId = ref<PageThemeId | null>(readPageThemeId(route.query.theme))
const theme = computed(() => resolvePageTheme(chosenThemeId.value ?? suggestedThemeId.value))

const editing = ref(route.query.edit === '1')
const content = ref<HubPageContent>({
  ...buildDevPageContent(),
  ...(route.query.photo === '0' ? { coverSrc: null } : {}),
})

const objectUrls: string[] = []

// Enregistrement simulé : un court délai, puis l'état est gardé en mémoire (lisible depuis la console).
async function save(snapshot: HubPageSnapshot) {
  await new Promise((resolve) => setTimeout(resolve, 250))
  if (route.query.erreur === '1') throw new Error('Enregistrement impossible. Vérifiez votre connexion.')
  const store = window as unknown as { __devPageSaves?: HubPageSnapshot[] }
  store.__devPageSaves = [...(store.__devPageSaves ?? []), JSON.parse(JSON.stringify(snapshot)) as HubPageSnapshot]
}

// Ici la photo reste dans le navigateur ; dans le tableau de bord elle part sur ImageKit.
async function uploadImage(file: File): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 250))
  const url = URL.createObjectURL(file)
  objectUrls.push(url)
  return url
}

const page = useHubPageEditing({ content, themeId: chosenThemeId, save, uploadImage })

watch(chosenThemeId, (id) => {
  if (id) void router.replace({ query: { ...route.query, theme: id } })
})

onBeforeUnmount(() => {
  objectUrls.forEach((url) => URL.revokeObjectURL(url))
})
</script>

<template>
  <ThemedHubPage
    :theme="theme"
    :content="content"
    :listings="listings"
    :editing="editing"
    :listings-message="listings.length ? null : 'Aucun logement en ligne pour le moment. Revenez bientôt !'"
    @update="page.onUpdate"
    @update-section="page.onUpdateSection"
    @add-section="page.onAddSection"
    @remove-section="page.onRemoveSection"
    @pick-image="page.onPickImage"
  >
    <template #footer>
      <LegalLinksCompact />
    </template>
  </ThemedHubPage>

  <PageEditBar
    :editing="editing"
    :theme-id="theme.id"
    :suggested-theme-id="placeSetting ? suggestedThemeId : null"
    :status="page.status.value"
    :can-undo="page.canUndo.value"
    :can-retry="page.canRetry.value"
    back-label="Mes annonces"
    @start="editing = true"
    @finish="editing = false"
    @undo="page.onUndo"
    @retry="page.retry"
    @back="editing = true"
    @select-theme="page.selectTheme"
  />
</template>
