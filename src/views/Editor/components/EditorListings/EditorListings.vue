<!-- File: src/views/Editor/components/EditorListings/EditorListings.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Camera, ChevronLeft, ChevronRight, Eye, Search } from 'lucide-vue-next'
import type { Swiper as SwiperInstance } from 'swiper/types'
import type { SwiperOptions } from 'swiper/types'
import { Swiper, SwiperSlide } from 'swiper/vue'

import type { UserListingCard } from '@/views/Editor/utils/listingApi'
import { orderByIndex } from '@/utils/medias/order'
import { createListingMediaSwiperParams } from '@/utils/swiper/listingMedia'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import { formatICUMessage } from '@/utils/i18n'
import { normalizeListingStatus } from '@/domain/listings/status'
import { getUserMaxActiveListings } from '@/domain/user/subscription'

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
const route = useRoute()
const listingContent = editorStatic.listings
const ACTIVE_LISTING_STATUSES = new Set(['published', 'blocked'])
const maxActiveListings = getUserMaxActiveListings()
const activeListingsCount = computed(() =>
  props.listings.reduce((count, listing) => count + (isActiveListingStatus(listing.status) ? 1 : 0), 0),
)
const remainingActiveListings = computed(() => Math.max(0, maxActiveListings - activeListingsCount.value))
const isActiveListingsLimitReached = computed(() => remainingActiveListings.value <= 0)
const newListingActiveUsage = computed(() =>
  listingContent.newListing.activeUsage
    .replace('{count}', String(activeListingsCount.value))
    .replace('{max}', String(maxActiveListings)),
)
const newListingRemaining = computed(() =>
  listingContent.newListing.remaining.replace('{count}', String(remainingActiveListings.value)),
)
const newListingRemainingDisplay = computed(() =>
  isActiveListingsLimitReached.value
    ? `${newListingRemaining.value} ${listingContent.newListing.remainingAlertSuffix}`
    : newListingRemaining.value,
)
const createListingRoute = computed(() => {
  const userId = route.params.userId
  if (typeof userId === 'string' && userId.trim()) {
    return {
      name: 'create-listing-user',
      params: { userId: userId.trim() },
    }
  }

  return { name: 'create-listing' }
})

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
      alt: (img.alt ?? title) || listingContent.media.defaultAlt,
      position: typeof img.position === 'number' ? img.position : undefined,
      index: typeof img.index === 'number' ? img.index : index,
    }))

  const ordered = orderByIndex(images)
  const coverSrc = (listing.coverSrc ?? '').trim()

  if (coverSrc && !ordered.some((img) => img.src === coverSrc)) {
    ordered.unshift({
      src: coverSrc,
      alt: title || listingContent.media.defaultAlt,
      position: 0,
      index: -1,
    })
  }

  if (!ordered.length && coverSrc) {
    return [
      { src: coverSrc, alt: title || listingContent.media.defaultAlt, position: 0, index: 0 },
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
  const normalized = normalizeListingStatus(status)
  if (!normalized) return ''

  switch (normalized) {
    case 'published':
      return listingContent.status.published
    case 'draft':
      return listingContent.status.draft
    case 'archived':
      return listingContent.status.archived
    case 'blocked':
      return listingContent.status.blocked
    case 'paused':
      return listingContent.status.paused
    case 'deleted':
      return listingContent.status.deleted
    default:
      return status ?? ''
  }
}

function statusVariant(status?: string) {
  const normalized = normalizeListingStatus(status)
  if (!normalized) return ''
  if (normalized === 'published') return 'is-published'
  if (normalized === 'draft') return 'is-draft'
  if (normalized === 'archived') return 'is-archived'
  if (normalized === 'blocked') return 'is-blocked'
  if (normalized === 'paused') return 'is-paused'
  if (normalized === 'deleted') return 'is-deleted'
  return 'is-unknown'
}

function isActiveListingStatus(status?: string) {
  const normalized = normalizeListingStatus(status)
  if (!normalized) return false
  return ACTIVE_LISTING_STATUSES.has(normalized)
}

function ratingPercent(rating?: number) {
  if (typeof rating !== 'number' || !Number.isFinite(rating)) return '0%'
  const clamped = Math.max(0, Math.min(5, rating))
  return `${(clamped / 5) * 100}%`
}

function guestLabel(count: number) {
  return formatICUMessage(listingContent.guests, { count })
}

function ratingTitle(value: number) {
  const formatted = value.toFixed(2)
  return listingContent.ratingTitle.replace('{rating}', formatted)
}

function ratingAria(value: number) {
  const formatted = value.toFixed(2)
  return listingContent.ratingAria.replace('{rating}', formatted)
}

function goToImageLabel(index: number) {
  return listingContent.carousel.goTo.replace('{index}', String(index))
}

// const DRAFT_STORAGE_PREFIX = 'indiehost:listing-draft:'
</script>

<template>
  <section class="editor-listings">
    <div class="toolbar">
      <div class="search">
        <Search
          class="icon"
          :size="20"
        />
        <input
          v-model="query"
          type="search"
          :placeholder="listingContent.searchPlaceholder"
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
                  @click.stop="handleSelect(listing.listingId)"
                  @pointerdown.stop="handleSelect(listing.listingId)"
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
                    :aria-label="listingContent.carousel.prev"
                    @click.stop="
                      (event) => {
                        handleSelect(listing.listingId)
                        slidePrev(listing.listingId)
                      }
                    "
                    @pointerdown.stop="handleSelect(listing.listingId)"
                  >
                    <ChevronLeft :size="20" />
                  </button>
                  <button
                    class="nav is-next"
                    type="button"
                    :aria-label="listingContent.carousel.next"
                    @click.stop="
                      (event) => {
                        handleSelect(listing.listingId)
                        slideNext(listing.listingId)
                      }
                    "
                    @pointerdown.stop="handleSelect(listing.listingId)"
                  >
                    <ChevronRight :size="20" />
                  </button>
                  <div
                    class="dots"
                    :aria-label="listingContent.carousel.pagination"
                    @click.stop="handleSelect(listing.listingId)"
                    @pointerdown.stop="handleSelect(listing.listingId)"
                  >
                    <button
                      v-for="(dot, index) in slidesFor(listing.listingId)"
                      :key="`${listing.listingId}-dot-${index}`"
                      class="dot"
                      :class="{ 'is-active': activeIndexFor(listing.listingId) === index }"
                      type="button"
                      :aria-label="goToImageLabel(index + 1)"
                      @click.stop="
                        (event) => {
                          handleSelect(listing.listingId)
                          slideTo(listing.listingId, index)
                        }
                      "
                      @pointerdown.stop="handleSelect(listing.listingId)"
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
                  :size="20"
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
                    :aria-label="listingContent.previewLink"
                    @click.stop
                  >
                    <Eye :size="20" />
                  </RouterLink>
                </div>
              </div>
            </div>

            <div class="body">
              <div class="main">
                <p class="title">
                  {{ listing.title || listingContent.untitled }}
                </p>
                <p
                  v-if="listing.guestCapacity"
                  class="meta"
                >
                  {{ listing.guestCapacity }} {{ guestLabel(listing.guestCapacity) }}
                </p>
              </div>

              <div class="footer">
                <span
                  v-if="typeof listing.pricePerNight === 'number'"
                  class="price"
                >
                  {{ listing.pricePerNight }} € <span class="suffix">{{ listingContent.priceSuffix }}</span>
                </span>
                <span
                  v-if="typeof listing.rating === 'number'"
                  class="rating"
                  :style="{ '--rating-percent': ratingPercent(listing.rating) }"
                  :title="ratingTitle(listing.rating)"
                  :aria-label="ratingAria(listing.rating)"
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
                :aria-label="listingContent.previewLink"
                @click.stop
              >
                <Eye :size="20" />
              </RouterLink>
            </div>
          </div> -->
        </article>

        <div class="new-card">
          <RouterLink :to="createListingRoute">
            <div class="content">
              <span>{{ listingContent.newListing.title }}</span>
              <small class="usage">{{ newListingActiveUsage }}</small>
              <small
                class="remaining"
                :class="{ 'is-limit-reached': isActiveListingsLimitReached }"
              >
                {{ newListingRemainingDisplay }}
              </small>
            </div>
          </RouterLink>
        </div>
      </div>
    </div>

    <div
      v-if="props.isLoading"
      class="state"
    >
      {{ editorStatic.states.loading }}
    </div>
    <div
      v-else-if="props.error"
      class="state"
    >
      {{ editorStatic.states.listingsLoadError }}
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Editor/components/EditorListings/editor-listings.scss';
</style>
