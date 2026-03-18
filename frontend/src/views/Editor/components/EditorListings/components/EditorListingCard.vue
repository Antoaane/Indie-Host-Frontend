<!-- File: src/views/Editor/components/EditorListings/components/EditorListingCard.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Camera, ChevronDown, ChevronLeft, ChevronRight, EllipsisVertical, Eye } from 'lucide-vue-next'
import type { Swiper as SwiperInstance } from 'swiper/types'
import type { SwiperOptions } from 'swiper/types'
import { Swiper, SwiperSlide } from 'swiper/vue'

import { normalizeListingStatus } from '@/domain/listings/status'
import { orderByIndex } from '@/utils/medias/order'
import { formatICUMessage } from '@/utils/i18n'
import { createListingMediaSwiperParams } from '@/utils/swiper/listingMedia'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import type { UserListingCard } from '@/views/Editor/utils/listingApi'
import ConfirmationDialog from '@/components/overlays/ConfirmationDialog.vue'

type ListingSlide = {
  src: string
  alt: string
  position?: number
  index?: number
}

type ListingContent = typeof editorStatic.listings

const props = defineProps<{
  listing: UserListingCard
  isSelected: boolean
  isStatusMenuOpen: boolean
  isActionsMenuOpen: boolean
  statusOptions: readonly string[]
  listingContent: ListingContent
  canPreview?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', listingId: string): void
  (e: 'preview', listingId: string): void
  (e: 'toggle-status-menu', listingId: string): void
  (e: 'toggle-actions-menu', listingId: string): void
  (e: 'close-menus'): void
  (e: 'status-change', payload: { listingId: string; status: string }): void
}>()

const swiper = ref<SwiperInstance | null>(null)
const activeIndex = ref(0)
const isDeleteOverlayOpen = ref(false)

const slides = computed<ListingSlide[]>(() => {
  const title = (props.listing.title ?? '').trim()

  const images = (props.listing.images ?? [])
    .filter((img) => Boolean(img?.src))
    .map((img, index) => ({
      src: img.src,
      alt: (img.alt ?? title) || props.listingContent.media.defaultAlt,
      position: typeof img.position === 'number' ? img.position : undefined,
      index: typeof img.index === 'number' ? img.index : index,
    }))

  const ordered = orderByIndex(images)
  const coverSrc = (props.listing.coverSrc ?? '').trim()

  if (coverSrc && !ordered.some((img) => img.src === coverSrc)) {
    ordered.unshift({
      src: coverSrc,
      alt: title || props.listingContent.media.defaultAlt,
      position: 0,
      index: -1,
    })
  }

  if (!ordered.length && coverSrc) {
    return [
      { src: coverSrc, alt: title || props.listingContent.media.defaultAlt, position: 0, index: 0 },
    ]
  }

  return ordered
})

const currentStatusLabel = computed(() => statusLabel(props.listing.status))
const normalizedStatus = computed(() => normalizeListingStatus(props.listing.status))
const hasNonPublishedStatus = computed(() => Boolean(normalizedStatus.value) && normalizedStatus.value !== 'published')
const nonPublishedOverlayLabel = computed(() => {
  if (!hasNonPublishedStatus.value) return ''
  if (normalizedStatus.value === 'paused') return props.listingContent.statusOverlay.paused
  return props.listingContent.statusOverlay.blocked
})
const statusMenuControlId = computed(() => `listing-status-menu-${props.listing.listingId}`)
const actionsMenuControlId = computed(() => `listing-actions-menu-${props.listing.listingId}`)
const deleteContent = computed(() => editorStatic.panels.listing.visibility.delete)

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
const cardSwiperParams = cardSwiperBaseParams as unknown as Record<string, unknown>

function registerSwiper(nextSwiper: SwiperInstance) {
  swiper.value = nextSwiper
  activeIndex.value = nextSwiper.realIndex ?? nextSwiper.activeIndex ?? 0
}

function syncActiveIndex(nextSwiper: SwiperInstance) {
  activeIndex.value = nextSwiper.realIndex ?? nextSwiper.activeIndex ?? 0
}

function slidePrev() {
  swiper.value?.slidePrev()
}

function slideNext() {
  swiper.value?.slideNext()
}

function slideTo(index: number) {
  swiper.value?.slideTo(index)
}

function handleSelect() {
  emit('select', props.listing.listingId)
}

function handlePreview() {
  emit('preview', props.listing.listingId)
}

function handleToggleStatusMenu() {
  emit('toggle-status-menu', props.listing.listingId)
}

function handleToggleActionsMenu() {
  emit('toggle-actions-menu', props.listing.listingId)
}

function handleSetListingStatus(status: string) {
  emit('close-menus')
  emit('status-change', { listingId: props.listing.listingId, status })
}

function handlePrev() {
  handleSelect()
  slidePrev()
}

function handleNext() {
  handleSelect()
  slideNext()
}

function handleGoTo(index: number) {
  handleSelect()
  slideTo(index)
}

function handleStatusMenuEscape() {
  emit('close-menus')
}

function handleActionsMenuEscape() {
  emit('close-menus')
}

function openDeleteOverlay() {
  emit('close-menus')
  isDeleteOverlayOpen.value = true
}

function closeDeleteOverlay() {
  isDeleteOverlayOpen.value = false
}

function confirmDelete() {
  emit('close-menus')
  emit('status-change', { listingId: props.listing.listingId, status: 'deleted' })
  closeDeleteOverlay()
}

function statusLabel(status?: string) {
  const normalized = normalizeListingStatus(status)
  if (!normalized) return ''

  switch (normalized) {
    case 'published':
      return props.listingContent.status.published
    case 'archived':
      return props.listingContent.status.archived
    case 'blocked':
      return props.listingContent.status.blocked
    case 'paused':
      return props.listingContent.status.paused
    case 'deleted':
      return props.listingContent.status.deleted
    default:
      return status ?? ''
  }
}

function statusVariant(status?: string) {
  const normalized = normalizeListingStatus(status)
  if (!normalized) return ''
  if (normalized === 'published') return 'is-published'
  if (normalized === 'archived') return 'is-archived'
  if (normalized === 'blocked') return 'is-blocked'
  if (normalized === 'paused') return 'is-paused'
  if (normalized === 'deleted') return 'is-deleted'
  return 'is-unknown'
}

function isStatusOptionSelected(currentStatus: string | undefined, option: string) {
  return normalizeListingStatus(currentStatus) === option
}

function statusOptionAria(option: string) {
  return props.listingContent.statusMenu.changeTo.replace('{status}', statusLabel(option))
}

function ratingPercent(rating?: number) {
  if (typeof rating !== 'number' || !Number.isFinite(rating)) return '0%'
  const clamped = Math.max(0, Math.min(5, rating))
  return `${(clamped / 5) * 100}%`
}

function guestLabel(count: number) {
  return formatICUMessage(props.listingContent.guests, { count })
}

function ratingTitle(value: number) {
  const formatted = value.toFixed(2)
  return props.listingContent.ratingTitle.replace('{rating}', formatted)
}

function ratingAria(value: number) {
  const formatted = value.toFixed(2)
  return props.listingContent.ratingAria.replace('{rating}', formatted)
}

function goToImageLabel(index: number) {
  return props.listingContent.carousel.goTo.replace('{index}', String(index))
}
</script>

<template>
  <article
    class="card"
    :class="{ 'is-selected': props.isSelected }"
  >
    <div
      class="select"
      role="button"
      tabindex="0"
      :aria-pressed="props.isSelected"
      @click="handleSelect"
      @keydown.enter.prevent="handleSelect"
      @keydown.space.prevent="handleSelect"
    >
      <div
        class="media"
        :class="{ 'is-non-published': hasNonPublishedStatus }"
      >
        <template v-if="slides.length">
          <div
            class="swiper-hitbox"
            @click.stop="handleSelect"
            @pointerdown.stop="handleSelect"
          >
            <Swiper
              class="swiper"
              v-bind="cardSwiperParams"
              @swiper="(swiperInstance) => registerSwiper(swiperInstance as SwiperInstance)"
              @slideChange="(swiperInstance) => syncActiveIndex(swiperInstance as SwiperInstance)"
            >
              <SwiperSlide
                v-for="(slide, idx) in slides"
                :key="`${props.listing.listingId}-${slide.src}-${idx}`"
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
              :aria-label="props.listingContent.carousel.prev"
              :title="props.listingContent.carousel.prev"
              @click.stop="handlePrev"
              @pointerdown.stop="handleSelect"
            >
              <ChevronLeft :size="20" />
            </button>
            <button
              class="nav is-next"
              type="button"
              :aria-label="props.listingContent.carousel.next"
              :title="props.listingContent.carousel.next"
              @click.stop="handleNext"
              @pointerdown.stop="handleSelect"
            >
              <ChevronRight :size="20" />
            </button>
            <div
              class="dots"
              :aria-label="props.listingContent.carousel.pagination"
              :title="props.listingContent.carousel.pagination"
              @click.stop="handleSelect"
              @pointerdown.stop="handleSelect"
            >
              <button
                v-for="(dot, index) in slides"
                :key="`${props.listing.listingId}-dot-${index}`"
                class="dot"
                :class="{ 'is-active': activeIndex === index }"
                type="button"
                :aria-label="goToImageLabel(index + 1)"
                :title="goToImageLabel(index + 1)"
                @click.stop="handleGoTo(index)"
                @pointerdown.stop="handleSelect"
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

        <div
          v-if="currentStatusLabel"
          class="status-menu"
          :class="{ 'is-open': props.isStatusMenuOpen }"
          @click.stop
          @pointerdown.stop
          @keydown.escape.stop="handleStatusMenuEscape"
        >
          <button
            class="status"
            :class="statusVariant(props.listing.status)"
            type="button"
            :aria-label="props.listingContent.statusMenu.open"
            :title="props.listingContent.statusMenu.label"
            :aria-expanded="props.isStatusMenuOpen"
            :aria-controls="statusMenuControlId"
            aria-haspopup="menu"
            @pointerdown.stop
            @click.stop="handleToggleStatusMenu"
          >
            <span class="text">{{ currentStatusLabel }}</span>
            <ChevronDown :size="14" />
          </button>

          <div
            :id="statusMenuControlId"
            class="status-options"
            role="menu"
            :aria-label="props.listingContent.statusMenu.label"
            :title="props.listingContent.statusMenu.label"
          >
            <button
              v-for="status in props.statusOptions"
              :key="`${props.listing.listingId}-${status}`"
              class="status-option"
              :class="{ 'is-active': isStatusOptionSelected(props.listing.status, status) }"
              type="button"
              role="menuitemradio"
              :aria-checked="isStatusOptionSelected(props.listing.status, status)"
              :aria-label="statusOptionAria(status)"
              :title="statusOptionAria(status)"
              :disabled="isStatusOptionSelected(props.listing.status, status)"
              @pointerdown.stop
              @click.stop="handleSetListingStatus(status)"
            >
              {{ statusLabel(status) }}
            </button>
          </div>
        </div>

        <div
          v-if="nonPublishedOverlayLabel"
          class="pending-changes status-overlay"
        >
          {{ nonPublishedOverlayLabel }}
        </div>

        <div
          v-if="props.listing.hasPendingChanges"
          class="pending-changes"
          :class="{ 'with-status-overlay': hasNonPublishedStatus }"
        >
          {{ props.listingContent.pendingChanges.label }}
        </div>
      </div>

      <div class="body">
        <div class="main">
          <p class="title">
            {{ props.listing.title || props.listingContent.untitled }}
          </p>
          <p
            v-if="props.listing.guestCapacity"
            class="meta"
          >
            {{ guestLabel(props.listing.guestCapacity) }}
          </p>
        </div>

        <div class="footer">
          <div class="pricing">
            <span
              v-if="typeof props.listing.pricePerNight === 'number'"
              class="price"
            >
              {{ props.listing.pricePerNight }} € <span class="suffix">{{ props.listingContent.priceSuffix }}</span>
            </span>
            <span
              v-if="typeof props.listing.rating === 'number'"
              class="rating"
              :style="{ '--rating-percent': ratingPercent(props.listing.rating) }"
              :title="ratingTitle(props.listing.rating)"
              :aria-label="ratingAria(props.listing.rating)"
              role="img"
            />
          </div>

          <div class="actions">
            <div
              v-if="props.canPreview !== false"
              class="preview"
            >
              <button
                type="button"
                :aria-label="props.listingContent.previewLink"
                :title="props.listingContent.previewLink"
                @click.stop="handlePreview"
                @pointerdown.stop
              >
                Voir l'aperçu
                <Eye :size="20" />
              </button>
            </div>
            <div
              class="dots actions-menu"
              :class="{ 'is-open': props.isActionsMenuOpen }"
              @click.stop
              @pointerdown.stop
              @keydown.escape.stop="handleActionsMenuEscape"
            >
              <div class="trigger">
                <button
                  type="button"
                  :aria-label="deleteContent.cta"
                  :title="deleteContent.title"
                  :aria-expanded="props.isActionsMenuOpen"
                  :aria-controls="actionsMenuControlId"
                  aria-haspopup="menu"
                  @click.stop="handleToggleActionsMenu"
                >
                  <EllipsisVertical :size="20" />
                </button>
              </div>

              <div
                :id="actionsMenuControlId"
                class="status-options"
                role="menu"
                :aria-label="deleteContent.title"
                :title="deleteContent.title"
              >
                <button
                  class="status-option is-danger"
                  type="button"
                  role="menuitem"
                  :aria-label="deleteContent.cta"
                  :title="deleteContent.cta"
                  @click.stop="openDeleteOverlay"
                >
                  {{ deleteContent.cta }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </article>

  <ConfirmationDialog
    :open="isDeleteOverlayOpen"
    :level="2"
    :title="deleteContent.confirmTitle"
    :message="deleteContent.confirmMessage"
    :confirm-label="deleteContent.confirmCta"
    :cancel-label="deleteContent.cancelCta"
    typing-hint='Tapez "supprimer" pour confirmer la suppression de cette annonce.'
    @close="closeDeleteOverlay"
    @cancel="closeDeleteOverlay"
    @confirm="confirmDelete"
  />
</template>
