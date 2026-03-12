<!-- File: src/views/Listing/_Listing.vue -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useHead } from '@unhead/vue'
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
  return undefined
})

const rawListing = ref<RawListingBundle | null>(null)
const isLoading = ref(false)

const statusFlags = computed(() => getListingStatusFlags(rawListing.value?.core?.status))
const pauseMessage = computed(() => (rawListing.value?.core?.pause_message ?? '').trim())
const pausedTitle = computed(() => 'Annonce en pause')
const pausedMessage = computed(() => pauseMessage.value || 'Cette annonce n’est plus en ligne temporairement.')
const deletedTitle = computed(() => 'Annonce supprimée')
const deletedMessage = computed(() => 'Cette annonce n’est plus disponible.')

function stripHtml(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

const seoTitle = computed(() => {
  const title = (rawListing.value?.core?.title ?? '').trim()
  if (!title) return 'Annonce IndieHost'
  return `${title} | IndieHost`
})

const seoDescription = computed(() => {
  const description = stripHtml(rawListing.value?.core?.description)
  if (description) return truncateText(description, 160)

  const title = (rawListing.value?.core?.title ?? '').trim()
  const city = (rawListing.value?.core?.city ?? '').trim()
  const country = (rawListing.value?.core?.country ?? '').trim()
  return truncateText([title, city, country].filter(Boolean).join(' · ') || 'Découvrez cette annonce sur IndieHost.', 160)
})

const seoImage = computed(() => {
  const firstImage = rawListing.value?.medias?.images?.[0]
  return typeof firstImage?.src === 'string' && firstImage.src.trim() ? firstImage.src.trim() : undefined
})

const canonicalUrl = computed(() => {
  if (typeof window === 'undefined') return undefined
  return window.location.href
})

useHead(() => ({
  title: seoTitle.value,
  link: canonicalUrl.value ? [{ rel: 'canonical', href: canonicalUrl.value }] : [],
  meta: [
    { name: 'description', content: seoDescription.value },
    { property: 'og:type', content: 'website' },
    { property: 'og:title', content: seoTitle.value },
    { property: 'og:description', content: seoDescription.value },
    ...(canonicalUrl.value ? [{ property: 'og:url', content: canonicalUrl.value }] : []),
    ...(seoImage.value ? [{ property: 'og:image', content: seoImage.value }] : []),
    { name: 'twitter:card', content: seoImage.value ? 'summary_large_image' : 'summary' },
    { name: 'twitter:title', content: seoTitle.value },
    { name: 'twitter:description', content: seoDescription.value },
    ...(seoImage.value ? [{ name: 'twitter:image', content: seoImage.value }] : []),
  ],
}))

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
      :key="listingKey ?? rawListing.core?.id ?? 'listing'"
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
