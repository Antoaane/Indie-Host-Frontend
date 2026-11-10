<!-- File: src/views/ListingHub/dev/DevPageThemesRoute.vue -->

<!-- Prévisualisation des thèmes de page et du mode édition, sur du faux contenu, sans compte ni API.
     Route de développement uniquement :
       /dev/page-themes?theme=maison|rivage|nocturne   thème choisi par l'hôte
       /dev/page-themes?lieu=mer|terre                 thème appliqué d'office d'après le lieu (sans rien : pas d'adresse)
       &edit=1                                         arrivée directe en mode édition
     Rien n'est enregistré : les modifications vivent en mémoire jusqu'au rechargement. -->

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  createPageSection,
  readPageThemeId,
  resolvePageTheme,
  suggestPageThemeId,
  type AddablePageSectionType,
  type HubPageContent,
  type PageSection,
  type PageThemeId,
  type PlaceSetting,
} from '@/domain/listings/pageThemes'
import LegalLinksCompact from '@/components/layouts/LegalLinksCompact.vue'
import PageEditBar from '@/views/ListingHub/themed/PageEditBar.vue'
import ThemedHubPage, { type PageImageTarget } from '@/views/ListingHub/themed/ThemedHubPage.vue'
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
const listings = computed(() => buildDevPageListings(placeSetting.value))

// Le choix de l'hôte prime ; sans choix, le thème suit le lieu des logements.
const suggestedThemeId = computed(() => suggestPageThemeId(listings.value.map((listing) => listing.setting)))
const chosenThemeId = computed(() => readPageThemeId(route.query.theme))
const theme = computed(() => resolvePageTheme(chosenThemeId.value ?? suggestedThemeId.value))

const editing = ref(route.query.edit === '1')
const content = ref<HubPageContent>(buildDevPageContent())
const status = ref('')
const removed = ref<{ section: PageSection; index: number } | null>(null)

let statusTimer: ReturnType<typeof setTimeout> | null = null
let sectionCounter = 0
const objectUrls: string[] = []

function flash(message: string, keepUndo = false) {
  status.value = message
  if (!keepUndo) removed.value = null
  if (statusTimer) clearTimeout(statusTimer)
  statusTimer = setTimeout(() => {
    status.value = ''
    removed.value = null
  }, keepUndo ? 6000 : 2000)
}

function setSections(sections: PageSection[]) {
  content.value = { ...content.value, sections }
}

function selectTheme(id: PageThemeId) {
  void router.replace({ query: { ...route.query, theme: id } })
  flash('Enregistré')
}

function onUpdate(patch: Partial<HubPageContent>) {
  content.value = { ...content.value, ...patch }
  flash('Enregistré')
}

function onUpdateSection(sectionId: string, patch: { title?: string; text?: string }) {
  setSections(content.value.sections.map((section) => (
    section.id === sectionId ? { ...section, ...patch } as PageSection : section
  )))
  flash('Enregistré')
}

function onAddSection(index: number, type: AddablePageSectionType) {
  sectionCounter += 1
  const sections = [...content.value.sections]
  sections.splice(index, 0, createPageSection(type, `section-${sectionCounter}`))
  setSections(sections)
  flash('Section ajoutée')
}

function onRemoveSection(sectionId: string) {
  const index = content.value.sections.findIndex((section) => section.id === sectionId)
  const section = content.value.sections[index]
  if (!section) return
  setSections(content.value.sections.filter((item) => item.id !== sectionId))
  removed.value = { section, index }
  flash('Section supprimée.', true)
}

function onUndo() {
  if (!removed.value) return
  const sections = [...content.value.sections]
  sections.splice(removed.value.index, 0, removed.value.section)
  setSections(sections)
  flash('Section rétablie')
}

// Ici la photo reste dans le navigateur ; dans l'éditeur réel elle part sur ImageKit.
function onPickImage(target: PageImageTarget, file: File) {
  const url = URL.createObjectURL(file)
  objectUrls.push(url)

  if (target.kind === 'cover') {
    onUpdate({ coverSrc: url })
    return
  }

  setSections(content.value.sections.map((section) => {
    if (section.id !== target.sectionId) return section
    if (section.type === 'text-image') return { ...section, imageSrc: url }
    if (section.type === 'gallery') {
      return { ...section, images: section.images.map((image, index) => (index === target.index ? url : image)) }
    }
    return section
  }))
  flash('Enregistré')
}

onBeforeUnmount(() => {
  if (statusTimer) clearTimeout(statusTimer)
  objectUrls.forEach((url) => URL.revokeObjectURL(url))
})
</script>

<template>
  <ThemedHubPage
    :theme="theme"
    :content="content"
    :listings="listings"
    :editing="editing"
    @update="onUpdate"
    @update-section="onUpdateSection"
    @add-section="onAddSection"
    @remove-section="onRemoveSection"
    @pick-image="onPickImage"
  >
    <template #footer>
      <LegalLinksCompact />
    </template>
  </ThemedHubPage>

  <PageEditBar
    :editing="editing"
    :theme-id="theme.id"
    :suggested-theme-id="placeSetting ? suggestedThemeId : null"
    :status="status"
    :can-undo="Boolean(removed)"
    @start="editing = true"
    @finish="editing = false"
    @undo="onUndo"
    @select-theme="selectTheme"
  />
</template>
