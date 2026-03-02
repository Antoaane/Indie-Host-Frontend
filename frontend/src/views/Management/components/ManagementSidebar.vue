<!-- File: src/views/Management/components/ManagementSidebar.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search } from 'lucide-vue-next'

import BaseSidebar from '@/components/layouts/BaseSidebar.vue'
import { normalizeSearchText } from '@/utils/search'
import type { UserListingCard } from '@/views/Editor/utils/listingApi'
import type { Reservation } from '@/views/Management/utils/managementReservations'

const props = defineProps<{
  listings: UserListingCard[]
  selectedListingId: string | null
  latestReservationByListingId: Record<string, Reservation | null>
  isLoading?: boolean
  error?: unknown
}>()

const emit = defineEmits<{
  (e: 'select', listingId: string): void
}>()

const query = ref('')

const filtered = computed(() => {
  const q = normalizeSearchText(query.value)
  if (!q) return props.listings
  return props.listings.filter((item) => normalizeSearchText(item.title).includes(q))
})

function coverFor(listing: UserListingCard) {
  return (listing.coverSrc ?? listing.images?.[0]?.src ?? '').trim()
}

function formatCurrency(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDateShort(iso?: string) {
  if (!iso) return ''
  const [
    year,
    month,
    day,
  ] = iso.split('-').map(Number)
  if (!year || !month || !day) return ''
  const date = new Date(Date.UTC(year, month - 1, day))
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    timeZone: 'UTC',
  }).format(date)
}

function latestLabel(listingId: string) {
  const reservation = props.latestReservationByListingId[listingId]
  if (!reservation) return 'Aucune r\u00e9servation r\u00e9cente'
  const date = formatDateShort(reservation.end)
  return date ? `Derni\u00e8re visite : ${reservation.guestName} - ${date}` : `Derni\u00e8re visite : ${reservation.guestName}`
}

function handleSelect(listingId: string) {
  emit('select', listingId)
}
</script>

<template>
  <BaseSidebar class="management-sidebar">
    <div class="scroll-container">
      <div class="toolbar">
        <div class="search">
          <Search class="icon" />
          <input
            v-model="query"
            type="search"
            placeholder="Recherchez une annonce"
          />
        </div>
      </div>
      <div class="list">
        <button
          v-for="listing in filtered"
          :key="listing.listingId"
          type="button"
          class="listing-card"
          :class="{ 'is-selected': listing.listingId === props.selectedListingId }"
          @click="handleSelect(listing.listingId)"
        >
          <div class="thumb">
            <img
              v-if="coverFor(listing)"
              :src="coverFor(listing)"
              :alt="listing.title || 'Annonce'"
              loading="lazy"
            />
            <div
              v-else
              class="placeholder"
            />
          </div>

          <div class="content">
            <p class="title">{{ listing.title || 'Annonce sans titre' }}</p>
            <p class="meta">{{ latestLabel(listing.listingId) }}</p>
          </div>

          <div
            class="price"
            v-if="typeof listing.pricePerNight === 'number'"
          >
            {{ formatCurrency(listing.pricePerNight) }}
          </div>
        </button>
      </div>
    </div>

    <template
      v-if="props.isLoading || props.error"
      #footer
    >
      <div class="state">
        <template v-if="props.isLoading"> Chargement des annonces&hellip; </template>
        <template v-else> Impossible de charger les annonces. </template>
      </div>
    </template>
  </BaseSidebar>
</template>

<style lang="scss">
@use '@/views/Management/components/management-sidebar.scss';
</style>
