<!-- File: src/views/ListingView/components/Layout/ListingMobileLayout.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import type { RangeISO } from '@/components/DatePicker/helpers/date'
import type { ListingParsed } from '@/views/ListingView/types/listing'
import type { ReservationPayload } from '@/views/ListingView/types/reservation'
import type { CheckoutConfirmationPayload } from '@/views/ListingView/types/checkout'

import Gallery from '@/views/ListingView/components/Gallery/Gallery.vue'
import Core from '@/views/ListingView/components/Core/Core.vue'
import Comments from '@/views/ListingView/components/Comments/Comments.vue'
import Booking from '@/views/ListingView/components/Booking/Booking.vue'
import BookingMin from '@/views/ListingView/components/BookingMin/BookingMin.vue'
import Checkout from '@/views/ListingView/components/Checkout/Checkout.vue'

const props = withDefaults(
  defineProps<{
    listingData: ListingParsed | null
    bookingRange?: RangeISO | null
    isCheckout: boolean
    checkoutPayload: ReservationPayload | null
    listingId: string | null
    ownerStripeConnectAccountId: string | null
    checkoutSubmitting?: boolean
    checkoutError?: string | null
    isBookingDisabled: boolean
    bookingDisabledLabel: string
    bookingDisabledHint: string
    canEditListing: boolean
    ownershipLoading: boolean
    editListingRoute: RouteLocationRaw
    previewOnly?: boolean
  }>(),
  {
    bookingRange: null,
    checkoutSubmitting: false,
    checkoutError: null,
    previewOnly: false,
  },
)

const emit = defineEmits<{
  (e: 'update:bookingRange', value: RangeISO | null): void
  (e: 'reserve', payload: ReservationPayload): void
  (e: 'cancel-checkout'): void
  (e: 'confirm-checkout', payload: CheckoutConfirmationPayload): void
}>()

const selection = computed<RangeISO | null>({
  get: () => props.bookingRange,
  set: (value) => emit('update:bookingRange', value),
})

function onReserve(payload: ReservationPayload) {
  emit('reserve', payload)
}

function onCancelCheckout() {
  emit('cancel-checkout')
}

function onConfirmCheckout(payload: CheckoutConfirmationPayload) {
  emit('confirm-checkout', payload)
}
</script>

<template>
  <RouterLink
    v-if="!props.previewOnly && props.canEditListing && !props.ownershipLoading"
    class="owner-edit-overlay"
    :to="props.editListingRoute"
    aria-label="Éditer cette annonce" title="Éditer cette annonce"
  >
    Éditer
  </RouterLink>

  <div class="main">
    <Transition name="listing-fade">
      <div
        v-if="!props.isCheckout"
        class="gallery"
      >
        <Gallery
          v-if="props.listingData"
          :medias="props.listingData.medias"
          :preview-only="props.previewOnly"
        />
        <template v-else><div class="skeleton">Chargement…</div></template>
      </div>
    </Transition>

    <div class="core">
      <div :class="{ panel: true, 'is-checkout': props.isCheckout }">
        <Transition
          name="listing-swap"
          mode="out-in"
        >
          <div
            v-if="props.listingData && !props.isCheckout"
            key="core"
          >
            <Core
              v-model:model-value="selection"
              :data="props.listingData"
              :preview-only="props.previewOnly"
            />
            <Comments
              :notes="props.listingData.notes"
              :comments="props.listingData.comments"
              :visibility="props.listingData.reviewsVisibility"
            />
          </div>
          <div
            v-else-if="props.listingData && props.checkoutPayload"
            key="checkout"
            class="checkout-stack"
          >
            <Checkout
              :listing="props.listingData"
              :reservation="props.checkoutPayload"
              :listing-id="props.listingId ?? ''"
              :connected-account-id="props.ownerStripeConnectAccountId"
              :is-submitting="props.checkoutSubmitting"
              :submit-error="props.checkoutError"
              @cancel="onCancelCheckout"
              @confirm="onConfirmCheckout"
            />
            <Booking
              v-model:model-value="selection"
              :price-per-night="props.listingData.bookings.price"
              :weekend-pricing="props.listingData.bookings.weekend"
              :fees="props.listingData.bookings.fees"
              :booked-days="props.listingData.bookings.bookedDays"
              :rules="props.listingData.bookings.rules"
              :disabled="props.isBookingDisabled"
              :disabled-label="props.bookingDisabledLabel"
              :disabled-hint="props.bookingDisabledHint"
              @reserve="onReserve"
            />
          </div>
          <div
            v-else
            key="core-skeleton"
            class="skeleton"
          >
            Chargement…
          </div>
        </Transition>
      </div>
    </div>
  </div>

  <div
    v-if="!props.isCheckout && !props.previewOnly"
    class="footer"
  >
    <span class="shape-container is-right">
      <svg
        class="shape"
        width="300"
        height="300"
        viewBox="0 0 300 300"
      >
        <path d="M 300 0 A 300 300 0 0 1 0 300 L 300 300 Z" />
      </svg>
    </span>
    <span class="shape-container is-left">
      <svg
        class="shape"
        width="300"
        height="300"
        viewBox="0 0 300 300"
      >
        <path d="M 300 0 A 300 300 0 0 1 0 300 L 300 300 Z" />
      </svg>
    </span>

    <BookingMin
      v-if="props.listingData"
      v-model:model-value="selection"
      :price-per-night="props.listingData.bookings.price"
      :fees="props.listingData.bookings.fees"
      :booked-days="props.listingData.bookings.bookedDays"
      :disabled="props.isBookingDisabled"
      :disabled-label="props.bookingDisabledLabel"
    />
    <template v-else>
      <div class="skeleton">Chargement…</div>
    </template>
  </div>
</template>
