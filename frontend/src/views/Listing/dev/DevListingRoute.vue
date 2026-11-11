<!-- File: src/views/Listing/dev/DevListingRoute.vue -->

<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import { useRoute } from 'vue-router'

import ListingView from '@/views/ListingView/_ListingView.vue'
import ListingHubView from '@/views/ListingHub/_ListingHub.vue'
import type { RawListingBundle } from '@/domain/listings/types'
import { createDevEditorSource } from '@/views/Editor/dev/devEditorSource'

// Route de développement (`/dev/listing`, enregistrée seulement en `import.meta.env.DEV`) : la page
// publique sur les annonces en mémoire de `/dev/editor`, sans API ni compte.
// - sans paramètre : le logement, mis « en ligne » pour que la réservation et son calendrier s'ouvrent ;
// - `?hub=1` : la page principale (ses logements ne se chargent pas sans API, c'est attendu) ;
//   avec `&proprietaire=1`, comme lorsqu'elle est ouverte depuis l'éditeur.
const route = useRoute()
const isHub = computed(() => 'hub' in route.query)
const rawListing = shallowRef<RawListingBundle | null>(null)

onMounted(async () => {
  const source = createDevEditorSource()
  const bundle = await source.fetchEditableListingBundle(isHub.value ? 'dev-hub' : 'dev-apartment')
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
    <template v-if="rawListing">
      <ListingHubView
        v-if="isHub"
        :rawListing="rawListing"
      />
      <ListingView
        v-else
        :rawListing="rawListing"
      />
    </template>
  </main>
</template>

<style lang="scss">
@use '@/views/Listing/listing.scss';
</style>
