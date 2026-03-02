<!-- File: src/views/ListingView/_ListingView.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useUser } from '@clerk/vue'

import { vp } from '@/utils/viewport'
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

import ListingDesktopLayout from '@/views/ListingView/components/Layout/ListingDesktopLayout.vue'
import ListingMobileLayout from '@/views/ListingView/components/Layout/ListingMobileLayout.vue'

const props = defineProps<{
  rawListing?: RawListingBundle | null
  aspect?: {
    width: number
    height: number
  }
}>()

const route = useRoute()
const controller = getListingsController()
const { isSignedIn, user } = useUser()

const listingData = computed<ListingParsed | null>(() => {
  if (!props.rawListing) return null
  return core(props.rawListing)
})

const statusFlags = computed(() => getListingStatusFlags(props.rawListing?.core?.status))
const isBookingDisabled = computed(() => !statusFlags.value.isBookable)
const bookingDisabledLabel = computed(() => (statusFlags.value.isBlocked ? 'Réservations bloquées' : 'Indisponible'))
const bookingDisabledHint = computed(() =>
  statusFlags.value.isBlocked
    ? 'Cette annonce reste consultable mais les réservations sont suspendues.'
    : 'Les réservations ne sont pas disponibles pour le moment.',
)

const bookingRange = ref<RangeISO | null>(null)

const listingId = computed(() => normalizeListingId(route.params.id) ?? normalizeListingId(props.rawListing?.core?.id) ?? null)
const currentUserId = computed(() => {
  const id = user.value?.id
  if (typeof id === 'string' && id.trim()) return id.trim()
  return null
})
const ownerStripeConnectAccountId = computed(() => getOwnerStripeConnectAccountId())

const { checkoutPayload, isCheckout, checkoutStatus, onReserve, cancelCheckout, confirmCheckout } = useListingCheckout({
  listingData,
  listingId,
  rawListing: computed(() => props.rawListing ?? null),
  fetchEditableListingBundle: (targetListingId) => controller.fetchEditableListingBundle(targetListingId),
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
  const images = orderByIndex(listingData.value?.medias?.images ?? [])
  const cover = images.find((image) => (image.position ?? 0) === 0) ?? images[0]
  return (cover?.src ?? '').trim()
})

const listingViewStyles = computed<Record<string, string | number>>(() => ({
  ...(aspectStyles.value as Record<string, string | number>),
  '--listing-view-cover-image': listingCoverImage.value ? `url(${JSON.stringify(listingCoverImage.value)})` : 'none',
}))
</script>

<template>
  <template v-if="vp.lg.value">
    <div
      :class="{ 'listing-view': true, editor: props.aspect, 'is-checkout': isCheckout }"
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
        @update:booking-range="bookingRange = $event"
        @reserve="onReserve"
        @cancel-checkout="cancelCheckout"
        @confirm-checkout="confirmCheckout"
      />
    </div>
  </template>

  <template v-else>
    <div
      :class="{ 'listing-view': true, 'is-checkout': isCheckout }"
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
