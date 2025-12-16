<!-- File: src/views/Editor/components/EditorListings/EditorListings.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search } from 'lucide-vue-next'

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
</script>

<template>
  <section class="editor-listings">
    <header class="editor-listings__toolbar">
      <div class="editor-listings__search">
        <Search class="editor-listings__search-icon" />
        <input
          v-model="query"
          class="editor-listings__search-input"
          type="search"
          placeholder="Rechercher une annonce"
        />
      </div>
    </header>

    <div class="editor-listings__grid">
      <button
        v-for="listing in filtered"
        :key="listing.listingId"
        class="editor-listing-card"
        :class="{ 'is-selected': listing.listingId === props.selectedListingId }"
        type="button"
        @click="handleSelect(listing.listingId)"
      >
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
          />
          <span
            v-if="listing.status"
            class="editor-listing-card__status"
          >
            {{ listing.status }}
          </span>
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
            <span v-if="typeof listing.pricePerNight === 'number'">
              {{ listing.pricePerNight }} € par nuits
            </span>
            <span v-if="typeof listing.rating === 'number'">
              ★ {{ listing.rating.toFixed(2) }}
            </span>
          </div>
        </div>
      </button>

      <button
        class="editor-listing-card--new"
        type="button"
        disabled
      >
        <span>+ Nouvelle annonce</span>
        <small>3 / 6 restantes</small>
      </button>
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
