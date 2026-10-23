<!-- File: src/views/ListingHub/_ListingHub.vue -->
<!-- Page principale d'un hôte : son domaine présente tous ses logements rattachés. -->

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { MapPin, Users } from 'lucide-vue-next'

import { fetchHubChildrenPublic, type ListingHubChildCard } from '@/domain/api/listingHubs'
import type { RawListingBundle } from '@/domain/listings/types'
import LegalLinksCompact from '@/components/layouts/LegalLinksCompact.vue'

const props = defineProps<{
  rawListing: RawListingBundle
}>()

const children = ref<ListingHubChildCard[]>([])
const isLoading = ref(false)
const loadError = ref<string | null>(null)

const hubId = computed(() => (props.rawListing.core?.id ?? '').trim())
const title = computed(() => (props.rawListing.core?.title ?? '').trim() || 'Nos logements')
const intro = computed(() => stripHtml(props.rawListing.core?.description))
const coverSrc = computed(() => {
  const images = Array.isArray(props.rawListing.medias?.images) ? props.rawListing.medias.images : []
  const first = images.find((image) => typeof image?.src === 'string' && image.src.trim())
  return first?.src ?? null
})
const hostName = computed(() => {
  const host = props.rawListing.host as Record<string, unknown> | null | undefined
  const candidates = [host?.displayName, host?.name, host?.pseudo, host?.firstName]
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
})

function stripHtml(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function formatPrice(value: number | null): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

function guestsLabel(count: number | null): string | null {
  if (!count) return null
  return `${count} voyageur${count > 1 ? 's' : ''}`
}

async function loadChildren() {
  if (!hubId.value) return
  isLoading.value = true
  loadError.value = null
  try {
    children.value = await fetchHubChildrenPublic(hubId.value)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Impossible de charger les logements.'
  } finally {
    isLoading.value = false
  }
}

watch(hubId, () => { void loadChildren() })
onMounted(() => { void loadChildren() })
</script>

<template>
  <article class="listing-hub">
    <header
      class="hub-hero"
      :class="{ 'has-cover': Boolean(coverSrc) }"
    >
      <img
        v-if="coverSrc"
        class="hub-cover"
        :src="coverSrc"
        alt=""
      />
      <div class="hub-hero-content">
        <h1>{{ title }}</h1>
        <p
          v-if="intro"
          class="hub-intro"
        >
          {{ intro }}
        </p>
        <p
          v-if="hostName"
          class="hub-host"
        >
          Proposé par {{ hostName }}
        </p>
      </div>
    </header>

    <section
      class="hub-listings"
      aria-labelledby="hub-listings-title"
    >
      <h2 id="hub-listings-title">
        {{ children.length > 1 ? 'Nos logements' : 'Notre logement' }}
      </h2>

      <p
        v-if="isLoading && !children.length"
        class="hub-state"
      >
        Chargement des logements…
      </p>
      <p
        v-else-if="loadError"
        class="hub-state"
        role="alert"
      >
        {{ loadError }}
      </p>
      <p
        v-else-if="!children.length"
        class="hub-state"
      >
        Aucun logement en ligne pour le moment. Revenez bientôt !
      </p>

      <ul
        v-else
        class="hub-grid"
      >
        <li
          v-for="child in children"
          :key="child.listingId"
        >
          <RouterLink
            :to="child.publicPath"
            class="hub-card"
          >
            <span class="hub-card-media">
              <img
                v-if="child.coverSrc"
                :src="child.coverSrc"
                :alt="child.title"
                loading="lazy"
              />
            </span>
            <span class="hub-card-body">
              <strong class="hub-card-title">{{ child.title }}</strong>
              <span
                v-if="child.city"
                class="hub-card-meta"
              >
                <MapPin
                  :size="14"
                  aria-hidden="true"
                />
                {{ child.city }}{{ child.region ? `, ${child.region}` : '' }}
              </span>
              <span
                v-if="guestsLabel(child.guestCapacity)"
                class="hub-card-meta"
              >
                <Users
                  :size="14"
                  aria-hidden="true"
                />
                {{ guestsLabel(child.guestCapacity) }}
              </span>
              <span
                v-if="formatPrice(child.pricePerNight)"
                class="hub-card-price"
              >
                À partir de {{ formatPrice(child.pricePerNight) }} / nuit
              </span>
              <span
                v-if="child.status === 'blocked'"
                class="hub-card-note"
              >
                Réservations momentanément fermées
              </span>
            </span>
          </RouterLink>
        </li>
      </ul>
    </section>

    <LegalLinksCompact />
  </article>
</template>

<style lang="scss">
@use '@/views/ListingHub/listing-hub.scss';
</style>
