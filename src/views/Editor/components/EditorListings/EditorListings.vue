<!-- File: src/views/Editor/components/EditorListings/EditorListings.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Camera, ChevronLeft, ChevronRight, Eye, Search } from 'lucide-vue-next'

import type { UserListingCard } from '@/views/Editor/utils/listingApi'

const props = defineProps<{
  listings: UserListingCard[]
  isLoading?: boolean
  error?: unknown
  selectedListingId: string | null
}>()

const emit = defineEmits<{
  (e: 'select', listingId: string): void
}>()

const query = ref('')

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.listings
  return props.listings.filter((item) => (item.title ?? '').toLowerCase().includes(q))
})

function handleSelect(listingId: string) {
  emit('select', listingId)
}

function statusLabel(status?: string) {
  const normalized = (status ?? '').trim().toLowerCase()
  if (!normalized) return ''

  switch (normalized) {
    case 'published':
      return 'Publiée'
    case 'draft':
      return 'Brouillon'
    case 'archived':
      return 'Archivée'
    default:
      return status ?? ''
  }
}

function statusVariant(status?: string) {
  const normalized = (status ?? '').trim().toLowerCase()
  if (!normalized) return ''
  if (normalized === 'published') return 'is-published'
  if (normalized === 'draft') return 'is-draft'
  if (normalized === 'archived') return 'is-archived'
  return 'is-unknown'
}

function ratingPercent(rating?: number) {
  if (typeof rating !== 'number' || !Number.isFinite(rating)) return '0%'
  const clamped = Math.max(0, Math.min(5, rating))
  return `${(clamped / 5) * 100}%`
}
</script>

<template>
  <section class="editor-listings">
    <div class="editor-listings__toolbar">
      <div class="editor-listings__search">
        <Search class="editor-listings__search-icon" />
        <input
          v-model="query"
          class="editor-listings__search-input"
          type="search"
          placeholder="Rechercher une annonce"
        />
      </div>
    </div>

    <div class="editor-listings__grid">
      <article
        v-for="listing in filtered"
        :key="listing.listingId"
        class="editor-listing-card"
        :class="{ 'is-selected': listing.listingId === props.selectedListingId }"
      >
        <div class="editor-listing-card__select">
          <button
            type="button"
            @click="handleSelect(listing.listingId)"
          >
            <div class="editor-listing-card__content">
              <div class="editor-listing-card__media">
                <img
                  v-if="listing.coverSrc"
                  :src="listing.coverSrc"
                  :alt="listing.title ?? ''"
                  loading="lazy"
                />
                <div
                  v-else
                  class="editor-listing-card__placeholder"
                >
                  <Camera
                    class="editor-listing-card__placeholder-icon"
                    :size="54"
                  />
                </div>

                <span
                  v-if="listing.status"
                  class="editor-listing-card__status"
                  :class="statusVariant(listing.status)"
                >
                  {{ statusLabel(listing.status) }}
                </span>

                <div
                  class="editor-listing-card__carousel"
                  aria-hidden="true"
                >
                  <span class="editor-listing-card__nav is-prev">
                    <ChevronLeft :size="18" />
                  </span>
                  <span class="editor-listing-card__nav is-next">
                    <ChevronRight :size="18" />
                  </span>
                  <div class="editor-listing-card__dots">
                    <span
                      v-for="dot in 6"
                      :key="dot"
                      class="editor-listing-card__dot"
                      :class="{ 'is-active': dot === 1 }"
                    />
                  </div>
                </div>
              </div>

              <div class="editor-listing-card__body">
                <p class="editor-listing-card__title">
                  {{ listing.title || 'Annonce sans titre' }}
                </p>
                <p
                  v-if="listing.guestCapacity"
                  class="editor-listing-card__meta"
                >
                  {{ listing.guestCapacity }} voyageurs
                </p>
                <div class="editor-listing-card__footer">
                  <span
                    v-if="typeof listing.pricePerNight === 'number'"
                    class="editor-listing-card__price"
                  >
                    {{ listing.pricePerNight }} € <span class="editor-listing-card__price-suffix">par nuit</span>
                  </span>
                  <span
                    v-if="typeof listing.rating === 'number'"
                    class="editor-listing-card__rating"
                    :style="{ '--rating-percent': ratingPercent(listing.rating) }"
                    :title="`${listing.rating.toFixed(2)} / 5`"
                    :aria-label="`${listing.rating.toFixed(2)} sur 5`"
                    role="img"
                  />
                </div>
              </div>
            </div>
          </button>
        </div>

        <div class="editor-listing-card__preview">
          <RouterLink
            :to="{ name: 'listing', params: { id: listing.listingId } }"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Prévisualiser l’annonce"
            @click.stop
          >
            <Eye :size="18" />
          </RouterLink>
        </div>
      </article>

      <div class="editor-listing-card--new">
        <button
          type="button"
          disabled
        >
          <div class="editor-listing-card--new__content">
            <span>+ Nouvelle annonce</span>
            <small>3 / 6 restantes</small>
          </div>
        </button>
      </div>
    </div>

    <div
      v-if="props.isLoading"
      class="editor-listings__state"
    >
      Chargement…
    </div>
    <div
      v-else-if="props.error"
      class="editor-listings__state"
    >
      Impossible de charger les annonces.
    </div>
  </section>
</template>
