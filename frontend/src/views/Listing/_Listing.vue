<!-- File: src/views/Listing/_Listing.vue -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useHead } from '@unhead/vue'
import { useRoute, useRouter } from 'vue-router'
// COMOOENENTS
import ListingView from '@/views/ListingView/_ListingView.vue'
import ListingUnavailable from '@/views/Listing/ListingUnavailable.vue'
import { loadBookings, loadComments, loadCore, loadHost, loadMedias, loadNotes, refreshListingAvailability } from '@/views/Listing/utils/fetchListingRaw'
import type { RawListingBundle } from '@/domain/listings/types'
import { getListingStatusFlags } from '@/domain/listings/status'
import { isManagedListingHostname } from '@/domain/listings/publicDomain'
import { buildListingSlug, normalizeListingSlug } from '@/domain/listings/slug'

const route = useRoute()
const router = useRouter()

function readRouteParam(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) return value[0].trim()
  return undefined
}

const listingKey = computed(() => {
  return readRouteParam(route.params.slug) ?? readRouteParam(route.params.id)
})

const rawListing = ref<RawListingBundle | null>(null)
const isLoading = ref(false)
const loadErrorMessage = ref<string | null>(null)
let activeFetchId = 0

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
const canonicalSlug = computed(() => buildListingSlug({
  existingSlug: rawListing.value?.core?.slug,
  title: rawListing.value?.core?.title,
  listingId: rawListing.value?.core?.id,
}))

function resolveFetchErrorMessage(error: unknown): string {
  const status = (error as { response?: { status?: unknown } })?.response?.status
  if (status === 404) return 'Cette annonce est introuvable ou a été retirée.'
  if (status === 403) return 'Cette annonce n est pas accessible depuis votre session.'
  if (typeof status === 'number' && status >= 500) return 'Le service est temporairement indisponible. Réessayez dans quelques instants.'
  return 'Cette annonce ne peut pas être affichée pour le moment.'
}

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
  const fetchId = activeFetchId + 1
  activeFetchId = fetchId
  isLoading.value = true
  loadErrorMessage.value = null
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

    const resolvedListingId = (core?.id ?? listingKey.value ?? '').trim()
    if (resolvedListingId) {
      void refreshAvailabilityInBackground(resolvedListingId, fetchId)
    }
  } catch (error) {
    if (fetchId !== activeFetchId) return
    rawListing.value = null
    loadErrorMessage.value = resolveFetchErrorMessage(error)
    console.warn('[Listing] failed to fetch public listing', { listingKey: listingKey.value, error })
  } finally {
    if (fetchId === activeFetchId) {
      isLoading.value = false
    }
  }
}

async function refreshAvailabilityInBackground(listingId: string, fetchId: number) {
  try {
    const syncResult = await refreshListingAvailability(listingId)

    if (fetchId !== activeFetchId) return
    if (!syncResult?.hasSources) return
    if (!syncResult.availabilityUpdated && syncResult.syncedSources === 0) return

    const refreshedBookings = await loadBookings(listingId)
    if (fetchId !== activeFetchId) return
    if (!rawListing.value) return

    rawListing.value = {
      ...rawListing.value,
      bookings: refreshedBookings,
    }
  } catch (error) {
    console.warn('[Listing] background availability sync failed', { listingId, error })
  }
}

watch(
  listingKey,
  () => {
    rawListing.value = null
    loadErrorMessage.value = null
    void fetchRawListing()
  },
  { immediate: true },
)

watch(
  [() => route.name, listingKey, canonicalSlug],
  ([routeName, currentListingKey, targetSlug]) => {
    if (routeName !== 'listing') return
    if (typeof window !== 'undefined' && isManagedListingHostname(window.location.hostname)) return
    const normalizedCurrent = normalizeListingSlug(currentListingKey)
    if (!targetSlug || normalizedCurrent === targetSlug) return

    void router.replace({
      name: 'listing',
      params: { slug: targetSlug },
      query: route.query,
      hash: route.hash,
    })
  },
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
    <ListingUnavailable
      v-else-if="loadErrorMessage"
      title="Impossible de charger cette annonce"
      :message="loadErrorMessage"
    />
    <template v-else>
      <div class="skeleton">
        {{ isLoading ? 'Chargement…' : 'Annonce indisponible.' }}
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
