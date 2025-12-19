<!-- File: src/views/Editor/components/EditorListings/EditorListings.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Camera, ChevronLeft, ChevronRight, Eye, Search } from 'lucide-vue-next'
import type { Swiper as SwiperInstance } from 'swiper/types'
import type { SwiperOptions } from 'swiper/types'
import { Swiper, SwiperSlide } from 'swiper/vue'

import type { UserListingCard } from '@/views/Editor/utils/listingApi'
import { orderByIndex } from '@/utils/medias/order'
import { createListingMediaSwiperParams } from '@/utils/swiper/listingMedia'

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

type ListingSlide = {
  src: string
  alt: string
  position?: number
  index?: number
}

function getListingSlides(listing: UserListingCard): ListingSlide[] {
  const title = (listing.title ?? '').trim()

  const images = (listing.images ?? [])
    .filter((img) => Boolean(img?.src))
    .map((img, index) => ({
      src: img.src,
      alt: (img.alt ?? title) || 'Photo du logement',
      position: typeof img.position === 'number' ? img.position : undefined,
      index: typeof img.index === 'number' ? img.index : index,
    }))

  const ordered = orderByIndex(images)
  const coverSrc = (listing.coverSrc ?? '').trim()

  if (coverSrc && !ordered.some((img) => img.src === coverSrc)) {
    ordered.unshift({
      src: coverSrc,
      alt: title || 'Photo du logement',
      position: 0,
      index: -1,
    })
  }

  if (!ordered.length && coverSrc) {
    return [
      { src: coverSrc, alt: title || 'Photo du logement', position: 0, index: 0 },
    ]
  }

  return ordered
}

const slidesByListingId = computed<Record<string, ListingSlide[]>>(() => {
  const map: Record<string, ListingSlide[]> = {}
  for (const listing of filtered.value) {
    map[listing.listingId] = getListingSlides(listing)
  }
  return map
})

function slidesFor(listingId: string): ListingSlide[] {
  return slidesByListingId.value[listingId] ?? []
}

const cardSwiperBaseParams = createListingMediaSwiperParams({
  autoplay: false,
  slidesPerView: 1,
  spaceBetween: 0,
  centeredSlides: true,
  withNavigationModule: true,
  withPaginationModule: true,
  navigation: false,
  pagination: false,
}) satisfies SwiperOptions

const swiperByListingId = new Map<string, SwiperInstance>()
const activeIndexByListingId = ref<Record<string, number>>({})

function activeIndexFor(listingId: string): number {
  return activeIndexByListingId.value[listingId] ?? 0
}

function registerSwiper(swiper: SwiperInstance, listingId: string) {
  swiperByListingId.set(listingId, swiper)
  activeIndexByListingId.value[listingId] = swiper.realIndex ?? swiper.activeIndex ?? 0
}

function syncActiveIndex(swiper: SwiperInstance, listingId: string) {
  activeIndexByListingId.value[listingId] = swiper.realIndex ?? swiper.activeIndex ?? 0
}

function slidePrev(listingId: string) {
  swiperByListingId.get(listingId)?.slidePrev()
}

function slideNext(listingId: string) {
  swiperByListingId.get(listingId)?.slideNext()
}

function slideTo(listingId: string, index: number) {
  swiperByListingId.get(listingId)?.slideTo(index)
}

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

console.log('props:', props)

// const DRAFT_STORAGE_PREFIX = 'indiehost:listing-draft:'
</script>

<template>
  <section class="editor-listings">
    <div class="toolbar">
      <div class="search">
        <Search class="icon" />
        <input
          v-model="query"
          class="input"
          type="search"
          placeholder="Rechercher une annonce"
        />
      </div>
    </div>

    <div class="scroll-container">
      <div class="grid">
        <article
          v-for="listing in filtered"
          :key="listing.listingId"
          class="card"
          :class="{ 'is-selected': listing.listingId === props.selectedListingId }"
        >
          <!-- <pre>{{ listing.listingId }}</pre>
          <pre>{{ `${DRAFT_STORAGE_PREFIX}${listing.listingId}` }}</pre> -->
          <div
            class="select"
            type="button"
            @click="handleSelect(listing.listingId)"
          >
            <!-- <div class="content"> -->
            <div class="media">
              <template v-if="slidesFor(listing.listingId).length">
                <div
                  class="swiper-hitbox"
                  @click.stop
                  @pointerdown.stop
                >
                  <Swiper
                    class="swiper"
                    v-bind="cardSwiperBaseParams"
                    @swiper="(swiper) => registerSwiper(swiper as SwiperInstance, listing.listingId)"
                    @slideChange="(swiper) => syncActiveIndex(swiper as SwiperInstance, listing.listingId)"
                  >
                    <SwiperSlide
                      v-for="(slide, idx) in slidesFor(listing.listingId)"
                      :key="`${listing.listingId}-${slide.src}-${idx}`"
                    >
                      <img
                        loading="lazy"
                        :src="slide.src"
                        :alt="slide.alt"
                      />
                    </SwiperSlide>
                  </Swiper>
                </div>

                <div class="carousel">
                  <button
                    class="nav is-prev"
                    type="button"
                    aria-label="Image précédente"
                    @click.stop="slidePrev(listing.listingId)"
                    @pointerdown.stop
                  >
                    <ChevronLeft :size="18" />
                  </button>
                  <button
                    class="nav is-next"
                    type="button"
                    aria-label="Image suivante"
                    @click.stop="slideNext(listing.listingId)"
                    @pointerdown.stop
                  >
                    <ChevronRight :size="18" />
                  </button>
                  <div
                    class="dots"
                    aria-label="Pagination du carrousel"
                    @click.stop
                    @pointerdown.stop
                  >
                    <button
                      v-for="(dot, index) in slidesFor(listing.listingId)"
                      :key="`${listing.listingId}-dot-${index}`"
                      class="dot"
                      :class="{ 'is-active': activeIndexFor(listing.listingId) === index }"
                      type="button"
                      :aria-label="`Aller à l’image ${index + 1}`"
                      @click.stop="slideTo(listing.listingId, index)"
                      @pointerdown.stop
                    />
                  </div>
                </div>
              </template>

              <div
                v-else
                class="placeholder"
              >
                <Camera
                  class="icon"
                  :size="54"
                />
              </div>

              <span
                v-if="listing.status"
                class="status"
                :class="statusVariant(listing.status)"
              >
                {{ statusLabel(listing.status) }}
              </span>

              <div class="preview">
                <div>
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
              </div>
            </div>

            <div class="body">
              <div class="main">
                <p class="title">
                  {{ listing.title || 'Annonce sans titre' }}
                </p>
                <p
                  v-if="listing.guestCapacity"
                  class="meta"
                >
                  {{ listing.guestCapacity }} voyageurs
                </p>
              </div>

              <div class="footer">
                <span
                  v-if="typeof listing.pricePerNight === 'number'"
                  class="price"
                >
                  {{ listing.pricePerNight }} € <span class="suffix">par nuit</span>
                </span>
                <span
                  v-if="typeof listing.rating === 'number'"
                  class="rating"
                  :style="{ '--rating-percent': ratingPercent(listing.rating) }"
                  :title="`${listing.rating.toFixed(2)} / 5`"
                  :aria-label="`${listing.rating.toFixed(2)} sur 5`"
                  role="img"
                />
              </div>
            </div>
            <!-- </div> -->
          </div>

          <!-- <div class="preview">
            <div>
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
          </div> -->
        </article>

        <div class="new-card">
          <button
            type="button"
            disabled
          >
            <div class="content">
              <span>+ Nouvelle annonce</span>
              <small>3 / 6 restantes</small>
            </div>
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="props.isLoading"
      class="state"
    >
      Chargement…
    </div>
    <div
      v-else-if="props.error"
      class="state"
    >
      Impossible de charger les annonces.
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Editor/components/EditorListings/editor-listings.scss';
</style>
