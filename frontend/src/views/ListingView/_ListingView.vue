<!-- File: src/views/ListingView/_ListingView.vue -->

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useUser } from '@clerk/vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { orderByIndex } from '@/utils/medias/order'
import { core } from '@/views/ListingView/utils/useParseContent'
import { getListingsController } from '@/domain/listings/controller'
import type { RawListingBundle } from '@/domain/listings/types'
import { getListingStatusFlags } from '@/domain/listings/status'
import { getOwnerStripeConnectAccountId } from '@/domain/user/stripeConnect'
import type { RangeISO } from '@/components/DatePicker/helpers/date'

import { useListingAspect } from '@/views/ListingView/composables/useListingAspect'
import { normalizeListingId, useListingOwnership } from '@/views/ListingView/composables/useListingOwnership'
import { useListingCheckout } from '@/views/ListingView/composables/useListingCheckout'
import type { ListingParsed } from '@/views/ListingView/types/listing'
import {
  provideListingViewportMode,
  type ListingViewportMode,
} from '@/views/ListingView/composables/useListingViewport'

import ListingDesktopLayout from '@/views/ListingView/components/Layout/ListingDesktopLayout.vue'
import ListingMobileLayout from '@/views/ListingView/components/Layout/ListingMobileLayout.vue'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

const props = withDefaults(
  defineProps<{
    rawListing?: RawListingBundle | null
    aspect?: {
      width: number
      height: number
    }
    forcedViewportMode?: ListingViewportMode
    previewOnly?: boolean
  }>(),
  { previewOnly: false },
)

const route = useRoute()
const controller = getListingsController()
const { isSignedIn, user } = useUser()

const listingData = computed<ListingParsed | null>(() => {
  if (!props.rawListing) return null
  return core(props.rawListing)
})

const statusFlags = computed(() => getListingStatusFlags(props.rawListing?.core?.status))
const isBookingDisabled = computed(() => isCheckout.value || !statusFlags.value.isBookable)
const bookingDisabledLabel = computed(() => {
  if (isCheckout.value) return 'Checkout en cours'
  return statusFlags.value.isBlocked ? 'Réservations bloquées' : 'Indisponible'
})
const bookingDisabledHint = computed(() =>
  isCheckout.value
    ? 'Complétez toutes les étapes du checkout pour confirmer la réservation.'
    : statusFlags.value.isBlocked
      ? 'Cette annonce reste consultable mais les réservations sont suspendues.'
      : 'Les réservations ne sont pas disponibles pour le moment.',
)

const bookingRange = ref<RangeISO | null>(null)

const listingId = computed(() => normalizeListingId(props.rawListing?.core?.id) ?? null)
const currentUserId = computed(() => {
  const id = user.value?.id
  if (typeof id === 'string' && id.trim()) return id.trim()
  return null
})
const ownerStripeConnectAccountId = computed(() => getOwnerStripeConnectAccountId())

const { checkoutPayload, isCheckout, checkoutStatus, onReserve, cancelCheckout, confirmCheckout } = useListingCheckout({
  listingsMode: controller.mode,
  listingData,
  listingId,
  rawListing: computed(() => props.rawListing ?? null),
  fetchEditableListingBundle: (targetListingId) => controller.fetchEditableListingBundle(targetListingId),
  syncListingAvailability: (targetListingId) => controller.syncListingAvailability(targetListingId),
  patchListingDraft: (targetListingId, payload) => controller.patchListingDraft(targetListingId, payload),
})

const { ownershipLookup, canEditListing, editListingRoute } = useListingOwnership({
  route,
  listingId,
  isCheckout,
  isSignedIn,
  currentUserId,
  fetchListings: (payload) => controller.fetchListings(payload),
})

const { listingView, aspectStyles } = useListingAspect(computed(() => props.aspect))

const listingCoverImage = computed(() => {
  const images = orderByIndex(listingData.value?.medias?.images ?? []).filter((image) => {
    return typeof image?.src === 'string' && image.src.trim().length > 0
  })
  const cover = images.find((image) => (image.position ?? 0) === 0) ?? images[0]
  return (cover?.src ?? '').trim()
})

const listingViewStyles = computed<Record<string, string | number>>(() => ({
  ...(aspectStyles.value as Record<string, string | number>),
  '--listing-view-cover-image': listingCoverImage.value ? `url(${JSON.stringify(listingCoverImage.value)})` : 'none',
}))

const previewContainerWidth = computed(() => {
  const width = Number(props.aspect?.width ?? 0)
  if (!Number.isFinite(width) || width <= 0) return null
  return width
})

const listingViewContainerWidth = ref<number | null>(null)
let listingViewResizeObserver: ResizeObserver | null = null

function updateListingViewContainerWidth() {
  const element = listingView.value
  if (!element) {
    listingViewContainerWidth.value = null
    return
  }

  const width = Number(element.clientWidth)
  if (!Number.isFinite(width) || width <= 0) {
    listingViewContainerWidth.value = null
    return
  }

  listingViewContainerWidth.value = width
}

watch(
  listingView,
  (element) => {
    listingViewResizeObserver?.disconnect()
    listingViewResizeObserver = null

    if (!element || typeof ResizeObserver === 'undefined') {
      updateListingViewContainerWidth()
      return
    }

    listingViewResizeObserver = new ResizeObserver(() => {
      updateListingViewContainerWidth()
    })
    listingViewResizeObserver.observe(element)
    updateListingViewContainerWidth()
  },
  { immediate: true },
)

const effectiveContainerWidth = computed<number | null>(() => {
  if (previewContainerWidth.value !== null) return previewContainerWidth.value
  if (listingViewContainerWidth.value !== null) return listingViewContainerWidth.value
  return null
})

const viewportMode = computed<ListingViewportMode>(() => {
  if (props.forcedViewportMode) return props.forcedViewportMode
  if (effectiveContainerWidth.value !== null) {
    if (effectiveContainerWidth.value >= 1024) return 'xxl'
    if (effectiveContainerWidth.value >= 768) return 'tablet'
    return 'sm'
  }
  return 'sm'
})

const isTabletLayout = computed(() => viewportMode.value === 'tablet')
const isMobileLayout = computed(() => viewportMode.value === 'sm')
const isDesktopLayout = computed(() => viewportMode.value === 'xxl')
const isTabletGalleryCollapsed = ref(false)
const tabletGalleryCollapseProgress = ref(0)

const showDesktopLayout = computed(() => {
  return viewportMode.value === 'xxl' || viewportMode.value === 'tablet'
})

const isTabletGalleryCollapseEnabled = computed(() => {
  return isTabletLayout.value && !isCheckout.value && !props.previewOnly
})

const isTabletGalleryScrollLocked = computed(() => {
  return isTabletGalleryCollapseEnabled.value && !isTabletGalleryCollapsed.value
})

const TABLET_GALLERY_COLLAPSE_DISTANCE_PX = 320
const TABLET_GALLERY_COLLAPSE_DONE_THRESHOLD = 0.995

let tabletGalleryObserver: ReturnType<typeof ScrollTrigger.observe> | null = null
let setTabletGalleryCollapse: ((value: number) => void) | null = null
let tabletCoreScrollEl: HTMLElement | null = null
let tabletCoreExpandWheelHandler: ((event: WheelEvent) => void) | null = null

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function killTabletGalleryObserver() {
  tabletGalleryObserver?.kill()
  tabletGalleryObserver = null
}

function applyTabletGalleryCollapseProgress(progress: number) {
  const normalized = clampProgress(progress)
  tabletGalleryCollapseProgress.value = normalized
  setTabletGalleryCollapse?.(normalized)
  isTabletGalleryCollapsed.value = normalized >= TABLET_GALLERY_COLLAPSE_DONE_THRESHOLD
  if (isTabletGalleryCollapsed.value) {
    tabletGalleryObserver?.disable()
    return
  }
  tabletGalleryObserver?.enable()
}

function resetTabletGalleryCollapseState() {
  tabletGalleryCollapseProgress.value = 0
  isTabletGalleryCollapsed.value = false

  const root = listingView.value
  if (!root) return
  root.style.setProperty('--tablet-gallery-collapse', '0')
}

function teardownTabletGalleryCollapse(reset = true) {
  if (tabletCoreScrollEl && tabletCoreExpandWheelHandler) {
    tabletCoreScrollEl.removeEventListener('wheel', tabletCoreExpandWheelHandler)
  }
  tabletCoreExpandWheelHandler = null
  killTabletGalleryObserver()
  setTabletGalleryCollapse = null
  tabletCoreScrollEl = null

  if (!reset) return
  resetTabletGalleryCollapseState()
}

function consumeObserverEvent(self: { event?: Event }) {
  const event = self.event
  if (!event || !event.cancelable) return
  event.preventDefault()
}

function setupTabletGalleryCollapse() {
  if (typeof window === 'undefined') return
  if (!isTabletGalleryCollapseEnabled.value) return

  const root = listingView.value
  if (!root) return

  const gallery = root.querySelector('.gallery')
  if (!(gallery instanceof HTMLElement)) return
  tabletCoreScrollEl = root.querySelector('#core')

  const quickToCollapse = gsap.quickTo(root, '--tablet-gallery-collapse', {
    duration: 0.24,
    ease: 'power2.out',
  })

  setTabletGalleryCollapse = (value: number) => {
    quickToCollapse(clampProgress(value))
  }

  tabletCoreExpandWheelHandler = (event: WheelEvent) => {
    if (!isTabletGalleryCollapseEnabled.value) return
    if (!isTabletGalleryCollapsed.value) return
    if (!tabletCoreScrollEl) return
    if (tabletCoreScrollEl.scrollTop > 0.5) return
    if (event.deltaY >= 0) return
    if (!event.cancelable) return

    event.preventDefault()
    tabletGalleryObserver?.enable()
    const nextProgress = tabletGalleryCollapseProgress.value + (event.deltaY / TABLET_GALLERY_COLLAPSE_DISTANCE_PX)
    applyTabletGalleryCollapseProgress(nextProgress)
  }

  tabletCoreScrollEl?.addEventListener('wheel', tabletCoreExpandWheelHandler, { passive: false })

  applyTabletGalleryCollapseProgress(0)

  tabletGalleryObserver = ScrollTrigger.observe({
    target: root,
    type: 'wheel,touch,pointer',
    preventDefault: true,
    allowClicks: true,
    tolerance: 2,
    onChangeY(self) {
      if (!isTabletGalleryScrollLocked.value) return
      const deltaY = Number(self.deltaY) || 0
      if (!deltaY) return

      if (deltaY > 0) {
        consumeObserverEvent(self)
        const nextProgress = tabletGalleryCollapseProgress.value + (deltaY / TABLET_GALLERY_COLLAPSE_DISTANCE_PX)
        applyTabletGalleryCollapseProgress(nextProgress)
        return
      }

      consumeObserverEvent(self)
      const nextProgress = tabletGalleryCollapseProgress.value + (deltaY / TABLET_GALLERY_COLLAPSE_DISTANCE_PX)
      applyTabletGalleryCollapseProgress(nextProgress)
    },
  })
}

watch(
  isTabletGalleryCollapseEnabled,
  async (enabled) => {
    teardownTabletGalleryCollapse(true)
    if (!enabled) return

    await nextTick()
    setupTabletGalleryCollapse()
  },
  { immediate: true },
)

watch(
  () => props.rawListing?.core?.id,
  async () => {
    if (!isTabletGalleryCollapseEnabled.value) return
    teardownTabletGalleryCollapse(true)
    await nextTick()
    setupTabletGalleryCollapse()
  },
)

onBeforeUnmount(() => {
  teardownTabletGalleryCollapse(false)
  listingViewResizeObserver?.disconnect()
  listingViewResizeObserver = null
})

provideListingViewportMode(computed<ListingViewportMode | null>(() => viewportMode.value))
</script>

<template>
  <template v-if="showDesktopLayout">
    <div
      :class="{ 'listing-view': true, editor: props.aspect, 'is-checkout': isCheckout, 'preview-only': props.previewOnly, 'is-mobile-layout': isMobileLayout, 'is-tablet-layout': isTabletLayout, 'is-desktop-layout': isDesktopLayout, 'is-tablet-gallery-scroll-lock': isTabletGalleryScrollLocked, 'is-tablet-gallery-collapsed': isTabletGalleryCollapsed }"
      ref="listingView"
      :style="listingViewStyles"
    >
      <ListingDesktopLayout
        :listing-data="listingData"
        :booking-range="bookingRange"
        :is-checkout="isCheckout"
        :checkout-payload="checkoutPayload"
        :listing-id="listingId"
        :owner-stripe-connect-account-id="ownerStripeConnectAccountId"
        :checkout-submitting="checkoutStatus.isSubmitting"
        :checkout-error="checkoutStatus.error"
        :is-booking-disabled="isBookingDisabled"
        :booking-disabled-label="bookingDisabledLabel"
        :booking-disabled-hint="bookingDisabledHint"
        :can-edit-listing="canEditListing"
        :ownership-loading="ownershipLookup.isLoading"
        :edit-listing-route="editListingRoute"
        :preview-only="props.previewOnly"
        @update:booking-range="bookingRange = $event"
        @reserve="onReserve"
        @cancel-checkout="cancelCheckout"
        @confirm-checkout="confirmCheckout"
      />
    </div>
  </template>

  <template v-else>
    <div
      :class="{ 'listing-view': true, editor: props.aspect, 'is-checkout': isCheckout, 'preview-only': props.previewOnly, 'is-mobile-layout': isMobileLayout, 'is-tablet-layout': isTabletLayout, 'is-desktop-layout': isDesktopLayout, 'is-tablet-gallery-scroll-lock': isTabletGalleryScrollLocked, 'is-tablet-gallery-collapsed': isTabletGalleryCollapsed }"
      ref="listingView"
      :style="listingViewStyles"
    >
      <ListingMobileLayout
        :listing-data="listingData"
        :booking-range="bookingRange"
        :is-checkout="isCheckout"
        :checkout-payload="checkoutPayload"
        :listing-id="listingId"
        :owner-stripe-connect-account-id="ownerStripeConnectAccountId"
        :checkout-submitting="checkoutStatus.isSubmitting"
        :checkout-error="checkoutStatus.error"
        :is-booking-disabled="isBookingDisabled"
        :booking-disabled-label="bookingDisabledLabel"
        :booking-disabled-hint="bookingDisabledHint"
        :can-edit-listing="canEditListing"
        :ownership-loading="ownershipLookup.isLoading"
        :edit-listing-route="editListingRoute"
        :preview-only="props.previewOnly"
        @update:booking-range="bookingRange = $event"
        @reserve="onReserve"
        @cancel-checkout="cancelCheckout"
        @confirm-checkout="confirmCheckout"
      />
    </div>
  </template>
</template>

<style lang="scss">
@use '@/views/ListingView/listing-view.scss';
</style>
