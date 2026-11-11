<!-- File: src/views/Management/components/ManagementSidebar.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { LayoutPanelTop, Search } from 'lucide-vue-next'

import BaseSidebar from '@/components/layouts/BaseSidebar.vue'
import { normalizeListingStatus } from '@/domain/listings/status'
import { normalizeSearchText } from '@/utils/search'
import type { UserListingCard } from '@/views/Editor/utils/listingApi'
import type { Reservation } from '@/views/Management/utils/managementReservations'

const props = defineProps<{
  listings: UserListingCard[]
  // Pages principales : elles n'ont pas de réservations, elles titrent le groupe de leurs logements.
  pages?: UserListingCard[]
  selectedListingId: string | null
  // Séjour en cours ou le plus proche d'aujourd'hui, par logement.
  closestReservationByListingId: Record<string, Reservation | null>
  isLoading?: boolean
  error?: unknown
}>()

const emit = defineEmits<{
  (e: 'select', listingId: string): void
}>()

const query = ref('')

const pageTitleById = computed(() => {
  const map = new Map<string, string>()
  for (const page of props.pages ?? []) {
    map.set(page.listingId, page.title?.trim() || 'Page sans titre')
  }
  return map
})

function pageIdOf(listing: UserListingCard): string | null {
  const parentId = listing.parentListingId ?? null
  return parentId && pageTitleById.value.has(parentId) ? parentId : null
}

// La recherche porte sur le nom du logement et sur celui de sa page.
const filtered = computed(() => {
  const q = normalizeSearchText(query.value)
  if (!q) return props.listings
  return props.listings.filter((item) => {
    if (normalizeSearchText(item.title).includes(q)) return true
    const pageId = pageIdOf(item)
    return pageId ? normalizeSearchText(pageTitleById.value.get(pageId)).includes(q) : false
  })
})

type ListingGroup = {
  id: string
  // Nom de la page principale, ou « Logements indépendants » ; absent quand il n'y a aucune page.
  title: string | null
  isPage: boolean
  listings: UserListingCard[]
}

const groups = computed<ListingGroup[]>(() => {
  const pageGroups: ListingGroup[] = []
  for (const [pageId, title] of pageTitleById.value) {
    const listings = filtered.value.filter((item) => pageIdOf(item) === pageId)
    if (listings.length) pageGroups.push({ id: pageId, title, isPage: true, listings })
  }

  const standalone = filtered.value.filter((item) => !pageIdOf(item))
  if (!pageGroups.length) return standalone.length ? [{ id: 'all', title: null, isPage: false, listings: standalone }] : []

  return standalone.length
    ? [...pageGroups, { id: 'standalone', title: 'Logements indépendants', isPage: false, listings: standalone }]
    : pageGroups
})

const emptyLabel = computed(() => {
  if (props.isLoading || props.error) return ''
  if (normalizeSearchText(query.value)) return 'Aucun logement ne correspond à cette recherche.'
  return 'Aucun logement pour le moment. Les réservations de vos logements apparaîtront ici.'
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

function todayIso() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

// Une ligne par logement : le séjour en cours, sinon la prochaine arrivée, sinon le dernier séjour.
function stayLabel(listingId: string) {
  const reservation = props.closestReservationByListingId[listingId]
  if (!reservation) return 'Aucune r\u00e9servation'

  const today = todayIso()
  const name = reservation.guestName
  if (reservation.start > today) return `Prochaine arriv\u00e9e : ${name}, le ${formatDateShort(reservation.start)}`
  if (reservation.end >= today) return `S\u00e9jour en cours : ${name}, jusqu\u2019au ${formatDateShort(reservation.end)}`
  return `Dernier s\u00e9jour : ${name}, parti le ${formatDateShort(reservation.end)}`
}

type ListingStatusBadge = {
  label: string
  variant: 'is-paused' | 'is-blocked'
}

function listingStatusBadge(status?: string): ListingStatusBadge | null {
  const normalized = normalizeListingStatus(status)
  if (normalized === 'paused') {
    return {
      label: 'En pause',
      variant: 'is-paused',
    }
  }
  if (normalized === 'blocked') {
    return {
      label: 'Réservations bloquées',
      variant: 'is-blocked',
    }
  }
  return null
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
            enterkeyhint="search"
            placeholder="Rechercher un logement"
            aria-label="Rechercher un logement"
          />
        </div>
      </div>
      <div class="list">
        <p
          v-if="!groups.length && emptyLabel"
          class="empty"
        >
          {{ emptyLabel }}
        </p>

        <section
          v-for="group in groups"
          :key="group.id"
          class="group"
          :class="{ 'is-page': group.isPage }"
        >
          <h3
            v-if="group.title"
            class="group-title"
          >
            <LayoutPanelTop
              v-if="group.isPage"
              :size="16"
              aria-hidden="true"
            />
            <span class="name">{{ group.title }}</span>
            <span
              v-if="group.isPage"
              class="kind"
            >Page principale</span>
          </h3>

          <div class="group-listings">
        <button
          v-for="listing in group.listings"
          :key="listing.listingId"
          type="button"
          class="listing-card"
          :class="{ 'is-selected': listing.listingId === props.selectedListingId }"
          :aria-pressed="listing.listingId === props.selectedListingId"
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
            <p
              v-if="listingStatusBadge(listing.status)"
              class="status-pill"
              :class="listingStatusBadge(listing.status)?.variant"
            >
              {{ listingStatusBadge(listing.status)?.label }}
            </p>
            <p class="meta">{{ stayLabel(listing.listingId) }}</p>
          </div>

          <div
            class="price"
            v-if="typeof listing.pricePerNight === 'number'"
          >
            {{ formatCurrency(listing.pricePerNight) }}<span class="unit">&nbsp;/ nuit</span>
          </div>
        </button>
          </div>
        </section>
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
