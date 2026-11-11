<!-- File: src/views/Listing/dev/DevListingRoute.vue -->

<script setup lang="ts">
import { onMounted, shallowRef } from 'vue'

import ListingView from '@/views/ListingView/_ListingView.vue'
import type { RawListingBundle } from '@/domain/listings/types'
import { createDevEditorSource } from '@/views/Editor/dev/devEditorSource'

// Route de développement (`/dev/listing`, enregistrée seulement en `import.meta.env.DEV`) : la page
// publique d'un logement sur l'annonce en mémoire de `/dev/editor`, mise « en ligne » pour que la
// réservation et son calendrier s'ouvrent. Sert à vérifier le rendu téléphone sans API ni compte.
const rawListing = shallowRef<RawListingBundle | null>(null)

onMounted(async () => {
  const source = createDevEditorSource()
  const bundle = await source.fetchEditableListingBundle('dev-apartment')
  rawListing.value = {
    ...bundle,
    core: { ...bundle.core, status: 'published' } as RawListingBundle['core'],
  }
})
</script>

<template>
  <main
    id="listing-page"
    class="listing"
  >
    <ListingView
      v-if="rawListing"
      :rawListing="rawListing"
    />
  </main>
</template>

<style lang="scss">
@use '@/views/Listing/listing.scss';
</style>
