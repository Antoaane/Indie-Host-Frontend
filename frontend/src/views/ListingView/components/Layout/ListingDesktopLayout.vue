<!-- File: src/views/ListingView/components/Layout/ListingDesktopLayout.vue -->

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
  }>(),
  {
    bookingRange: null,
    checkoutSubmitting: false,
    checkoutError: null,
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
    v-if="props.canEditListing && !props.ownershipLoading"
    class="owner-edit-overlay"
    :to="props.editListingRoute"
    aria-label="Éditer cette annonce"
  >
    Éditer
  </RouterLink>

  <Transition name="listing-fade">
    <div
      v-if="!props.isCheckout"
      class="gallery"
    >
      <Gallery
        v-if="props.listingData"
        :medias="props.listingData.medias"
      />
      <template v-else><div class="skeleton">Chargement…</div></template>
    </div>
  </Transition>

  <div
    v-if="props.isCheckout"
    class="gallery is-placeholder"
    aria-hidden="true"
  />

  <div class="core">
    <Transition
      name="listing-swap"
      mode="out-in"
    >
      <Core
        v-if="props.listingData && !props.isCheckout"
        key="core"
        v-model:model-value="selection"
        :data="props.listingData"
      />
      <Checkout
        v-else-if="props.listingData && props.checkoutPayload"
        key="checkout"
        :listing="props.listingData"
        :reservation="props.checkoutPayload"
        :listing-id="props.listingId ?? ''"
        :connected-account-id="props.ownerStripeConnectAccountId"
        :is-submitting="props.checkoutSubmitting"
        :submit-error="props.checkoutError"
        @cancel="onCancelCheckout"
        @confirm="onConfirmCheckout"
      />
      <div
        v-else
        key="core-skeleton"
        class="skeleton"
      >
        Chargement…
      </div>
    </Transition>
  </div>

  <div class="stay">
    <Booking
      v-if="props.listingData"
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
    <template v-else>
      <div class="skeleton">Chargement…</div>
    </template>

    <Transition name="listing-fade">
      <div v-if="!props.isCheckout">
        <Comments
          v-if="props.listingData"
          :notes="props.listingData.notes"
          :comments="props.listingData.comments"
        />
        <template v-else><div class="skeleton">Chargement…</div></template>
      </div>
    </Transition>
  </div>
</template>
