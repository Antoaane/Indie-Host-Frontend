<!-- File: src/views/Listing/_Listing.vue -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
// COMOOENENTS
import ListingView from '@/views/ListingView/_ListingView.vue'
import ListingUnavailable from '@/views/Listing/ListingUnavailable.vue'
import { loadBookings, loadComments, loadCore, loadHost, loadMedias, loadNotes } from '@/views/Listing/utils/fetchListingRaw'
import type { RawListingBundle } from '@/domain/listings/types'
import { getListingStatusFlags } from '@/domain/listings/status'

const route = useRoute()
const listingKey = computed(() => {
  const id = route.params.id
  if (typeof id === 'string' && id.trim()) return id.trim()
  if (Array.isArray(id) && id[0]?.trim()) return id[0].trim()
  return 'default-listing'
})

const rawListing = ref<RawListingBundle | null>(null)
const isLoading = ref(false)

const statusFlags = computed(() => getListingStatusFlags(rawListing.value?.core?.status))
const pauseMessage = computed(() => (rawListing.value?.core?.pause_message ?? '').trim())
const pausedTitle = computed(() => 'Annonce en pause')
const pausedMessage = computed(() => pauseMessage.value || 'Cette annonce n’est plus en ligne temporairement.')
const deletedTitle = computed(() => 'Annonce supprimée')
const deletedMessage = computed(() => 'Cette annonce n’est plus disponible.')

async function fetchRawListing() {
  isLoading.value = true
  try {
    const [
      core,
      host,
      bookings,
      medias,
      notes,
      comments,
    ] = await Promise.all([
      loadCore(listingKey.value),
      loadHost(listingKey.value),
      loadBookings(listingKey.value),
      loadMedias(listingKey.value),
      loadNotes(listingKey.value),
      loadComments(listingKey.value),
    ])
    rawListing.value = { core, host, bookings, medias, notes, comments }
  } finally {
    isLoading.value = false
  }
}

watch(
  listingKey,
  () => {
    rawListing.value = null
    void fetchRawListing()
  },
  { immediate: true },
)
</script>

<template>
  <main
    id="listing-page"
    class="listing"
  >
    <template v-if="rawListing && statusFlags.isPaused">
      <ListingUnavailable
        :title="pausedTitle"
        :message="pausedMessage"
      />
    </template>
    <template v-else-if="rawListing && statusFlags.isDeleted">
      <ListingUnavailable
        :title="deletedTitle"
        :message="deletedMessage"
      />
    </template>
    <ListingView
      v-else-if="rawListing"
      :key="listingKey"
      :rawListing="rawListing"
    />
    <template v-else>
      <div class="skeleton">
        {{ isLoading ? 'Chargement…' : 'Aucune donnée' }}
      </div>
    </template>
  </main>
</template>

<style lang="scss">
/* File: src/views/Listing/listing.scss */

@use '@/styles/variables/globals' as *;

.listing#listing-page {
  height: 100vh;

  @include min-width(lg) {
    overflow: hidden;
  }

  > .sub-container {
    height: 100vh;
  }
}
</style>
