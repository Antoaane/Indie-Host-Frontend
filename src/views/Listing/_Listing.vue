<!-- File: src/views/Listing/_Listing.vue -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
// COMOOENENTS
import ListingView from '@/views/ListingView/ListingView.vue'
import {
  loadBookings,
  loadComments,
  loadCore,
  loadHost,
  loadMedias,
  loadNotes,
} from '@/views/Listing/utils/fetchListingRaw'
import type { RawListingBundle } from '@/views/ListingView/utils/useParseContent'

const route = useRoute()
const listingKey = computed(() => {
  const id = route.params.id
  if (typeof id === 'string' && id.trim()) return id.trim()
  if (Array.isArray(id) && id[0]?.trim()) return id[0].trim()
  return 'default-listing'
})

const rawListing = ref<RawListingBundle | null>(null)
const isLoading = ref(false)

async function fetchRawListing() {
  isLoading.value = true
  try {
    const [core, host, bookings, medias, notes, comments] = await Promise.all([
      loadCore(),
      loadHost(),
      loadBookings(),
      loadMedias(),
      loadNotes(),
      loadComments(),
    ])
    rawListing.value = { core, host, bookings, medias, notes, comments }
  } finally {
    isLoading.value = false
  }
}

watch(listingKey, () => {
  rawListing.value = null
  void fetchRawListing()
}, { immediate: true })
</script>

<template>
  <main id="listing-page">
    <div class="sub-container">
      <ListingView
        v-if="rawListing"
        :key="listingKey"
        :rawListing="rawListing"
      />
      <template v-else>
        <div class="skeleton">
          {{ isLoading ? 'Chargement…' : 'Aucune donnée' }}
        </div>
      </template>
    </div>
  </main>
</template>

<style lang="scss">
@use '@/views/Listing/listing.scss';
</style>
