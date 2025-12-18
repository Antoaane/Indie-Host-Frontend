<!-- File: src/views/ListingView/ListingView.vue -->

<script setup lang="ts">
// DEPS
import { computed, ref } from 'vue'

// UTILS
import { vp } from '@/utils/viewport'
import { listingCore, type RawListingBundle } from '@/views/ListingView/utils/useParseContent'
import type { RangeISO } from '@/components/DatePicker/helpers/date'

// COMPONENTS
import Gallery from '@/views/ListingView/components/Gallery/Gallery.vue'
import ListingCore from '@/views/ListingView/components/ListingCore/ListingCore.vue'
import ListingComments from '@/views/ListingView/components/ListingComments/ListingComments.vue'
import Checkout from '@/views/ListingView/components/Checkout/Checkout.vue'
import CheckoutMin from '@/views/ListingView/components/CheckoutMin/CheckoutMin.vue'

import type { ListingParsed } from '@/views/ListingView/types/listing'

const props = defineProps<{
  rawListing?: RawListingBundle | null
}>()

const listingData = computed<ListingParsed | null>(() => {
  if (!props.rawListing) return null
  return listingCore(props.rawListing)
})
const bookingRange = ref<RangeISO | null>(null)
</script>

<template>
  <template v-if="vp.lg.value">
    <div class="listing-view">
      <div class="gallery">
        <Gallery
          v-if="listingData"
          :medias="listingData.medias"
        />
        <template v-else><div class="skeleton">Chargement…</div></template>
      </div>

      <div class="core">
        <ListingCore
          v-if="listingData"
          v-model:model-value="bookingRange"
          :data="listingData"
        />
        <template v-else><div class="skeleton">Chargement…</div></template>
      </div>

      <div class="stay">
        <Checkout
          v-if="listingData"
          v-model:model-value="bookingRange"
          :price-per-night="listingData.bookings.price"
          :fees="listingData.bookings.fees"
          :booked-days="listingData.bookings.bookedDays"
        />
        <template v-else>
          <div class="skeleton">Chargement…</div>
        </template>

        <ListingComments
          v-if="listingData"
          :notes="listingData.notes"
          :comments="listingData.comments"
        />
        <template v-else><div class="skeleton">Chargement…</div></template>
      </div>
    </div>
  </template>

  <template v-else>
    <div class="listing-view">
      <div class="main">
        <div class="gallery">
          <Gallery
            v-if="listingData"
            :medias="listingData.medias"
          />
          <template v-else><div class="skeleton">Chargement…</div></template>
        </div>

        <div class="core">
          <div class="panel">
            <ListingCore
              v-if="listingData"
              v-model:model-value="bookingRange"
              :data="listingData"
            />
            <template v-else><div class="skeleton">Chargement…</div></template>

            <ListingComments
              v-if="listingData"
              :notes="listingData.notes"
              :comments="listingData.comments"
            />
            <template v-else><div class="skeleton">Chargement…</div></template>
          </div>
        </div>
      </div>

      <footer class="footer">
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

        <CheckoutMin
          v-if="listingData"
          v-model:model-value="bookingRange"
          :price-per-night="listingData.bookings.price"
          :fees="listingData.bookings.fees"
          :booked-days="listingData.bookings.bookedDays"
        />
        <template v-else>
          <div class="skeleton">Chargement…</div>
        </template>
      </footer>
    </div>
  </template>
</template>

<style lang="scss">
@use '@/views/ListingView/listing-view.scss';
</style>
