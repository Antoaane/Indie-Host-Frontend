<!-- File: src/views/Domains/DomainPanel.vue -->

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { ListingDomainRecord } from '@/domain/api/listingDomains'
import { getListingsController } from '@/domain/listings/controller'
import type { UserListingCard } from '@/domain/listings/types'
import { readActiveUserId } from '@/router/backOfficeUser'
import ListingCustomDomainPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/CustomDomainPanel.vue'
import ListingSubdomainPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/DomainPanel.vue'

const route = useRoute()
const router = useRouter()
const listingsController = getListingsController()

const listings = ref<UserListingCard[]>([])
const selectedListingId = ref('')
const isLoadingListings = ref(false)
const listingsError = ref<string | null>(null)

const activeUserId = computed(() => readActiveUserId(route.params.userId))
const hasListings = computed(() => listings.value.length > 0)
const selectedListing = computed(() => listings.value.find((listing) => listing.listingId === selectedListingId.value) ?? null)

function readQueryValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (Array.isArray(value)) {
    const first = value[0]
    if (typeof first === 'string' && first.trim()) return first.trim()
  }
  return null
}

function formatListingLabel(listing: UserListingCard): string {
  const title = (listing.title ?? '').trim() || 'Annonce sans titre'
  const status = (listing.status ?? '').trim()
  if (!status) return title
  return `${title} (${status})`
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message.trim()
  }
  return fallback
}

function syncListingIdQuery(listingId: string | null) {
  const currentListingId = readQueryValue(route.query.listingId)
  const normalizedNext = listingId?.trim() || null
  if (currentListingId === normalizedNext) return

  const nextQuery = { ...route.query }
  if (normalizedNext) {
    nextQuery.listingId = normalizedNext
  } else {
    delete nextQuery.listingId
  }

  void router.replace({
    query: nextQuery,
    hash: route.hash,
  })
}

function applyDomainToListing(domain: ListingDomainRecord) {
  const listingId = domain.listingId.trim()
  if (!listingId) return

  const index = listings.value.findIndex((listing) => listing.listingId === listingId)
  if (index < 0) return

  const next = { ...listings.value[index] }

  if (domain.subdomainSlug) {
    next.subdomainSlug = domain.subdomainSlug
  } else {
    delete next.subdomainSlug
  }

  // Un domaine personnalisé actif devient l'adresse publique affichée sur la carte.
  const publicUrl = domain.customDomainStatus === 'verified' && domain.customDomainUrl
    ? domain.customDomainUrl
    : domain.publicUrl
  if (publicUrl) {
    next.publicUrl = publicUrl
  } else {
    delete next.publicUrl
  }

  listings.value.splice(index, 1, next)
}

async function loadListings() {
  isLoadingListings.value = true
  listingsError.value = null

  try {
    const fetched = await listingsController.fetchListings({
      userId: activeUserId.value ?? undefined,
      includeDeleted: false,
    })

    listings.value = [...fetched].sort((left, right) =>
      formatListingLabel(left).localeCompare(formatListingLabel(right), 'fr', { sensitivity: 'base' }))

    if (!listings.value.length) {
      selectedListingId.value = ''
      syncListingIdQuery(null)
      return
    }

    const listingIdFromQuery = readQueryValue(route.query.listingId)
    const hasRequestedListing = listingIdFromQuery
      ? listings.value.some((listing) => listing.listingId === listingIdFromQuery)
      : false
    const fallbackListingId = listings.value[0]?.listingId ?? ''
    const nextListingId = hasRequestedListing && listingIdFromQuery ? listingIdFromQuery : fallbackListingId
    selectedListingId.value = nextListingId
    syncListingIdQuery(selectedListingId.value || null)
  } catch (error) {
    console.error('[Domains] failed to load listings', error)
    listings.value = []
    selectedListingId.value = ''
    listingsError.value = resolveErrorMessage(error, 'Impossible de charger vos annonces pour le moment.')
  } finally {
    isLoadingListings.value = false
  }
}

watch(
  () => route.query.listingId,
  (nextValue) => {
    const nextListingId = readQueryValue(nextValue)
    if (!nextListingId || !listings.value.length) return
    if (!listings.value.some((listing) => listing.listingId === nextListingId)) return
    if (selectedListingId.value === nextListingId) return
    selectedListingId.value = nextListingId
  },
)

watch(selectedListingId, (nextListingId) => {
  syncListingIdQuery(nextListingId || null)
})

watch(
  () => route.params.userId,
  () => {
    void loadListings()
  },
)

onMounted(() => {
  void loadListings()
})
</script>

<template>
  <section class="domain-panel">
    <div class="domain-panel__header">
      <h1>Domaines de l annonce</h1>
      <p>Chaque annonce dispose d un sous-domaine IndieHost gratuit et peut aussi utiliser un nom de domaine que vous possedez deja.</p>
    </div>

    <section class="domain-panel__section">
      <h2>Annonce a configurer</h2>
      <p class="domain-panel__hint">Choisissez une annonce puis gerez son sous-domaine public.</p>

      <p
        v-if="isLoadingListings"
        class="domain-panel__feedback"
        aria-live="polite"
      >
        Chargement des annonces...
      </p>

      <p
        v-else-if="listingsError"
        class="domain-panel__feedback is-error"
        role="alert"
      >
        {{ listingsError }}
      </p>

      <template v-else-if="hasListings">
        <label for="domains-listing-select">Annonce</label>
        <select
          id="domains-listing-select"
          v-model="selectedListingId"
        >
          <option
            v-for="listing in listings"
            :key="listing.listingId"
            :value="listing.listingId"
          >
            {{ formatListingLabel(listing) }}
          </option>
        </select>

        <p
          v-if="selectedListing?.subdomainSlug"
          class="domain-panel__feedback is-success"
        >
          Sous-domaine actuel: {{ selectedListing.subdomainSlug }}
        </p>

        <ListingSubdomainPanel
          v-if="selectedListingId"
          :listing-id="selectedListingId"
          @updated="applyDomainToListing"
        />
      </template>

      <p
        v-else
        class="domain-panel__feedback"
      >
        Aucune annonce n est disponible pour ce compte.
      </p>
    </section>

    <section class="domain-panel__section">
      <h2>Domaine personnalise</h2>
      <p class="domain-panel__hint">Vous possedez deja un nom de domaine (ex. www.gite-belair.fr) ? Rattachez-le a l annonce selectionnee.</p>

      <ListingCustomDomainPanel
        v-if="selectedListingId"
        :listing-id="selectedListingId"
        @updated="applyDomainToListing"
      />

      <p
        v-else
        class="domain-panel__feedback"
      >
        Selectionnez une annonce pour rattacher un nom de domaine.
      </p>
    </section>
  </section>
</template>

<style lang="scss">
@use '@/views/Domains/domain-panel.scss';
</style>
