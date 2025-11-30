<!-- File: src/views/ListingView/ListingView.vue -->

<script setup lang="ts">
// DEPS
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { ScrollSmoother } from 'gsap/ScrollSmoother'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import gsap from 'gsap'

// UTILS
import { vp } from '@/utils/viewport'
import { listingCore } from '@/views/ListingView/utils/useParseContent'

// COMPONENTS
import Gallery from '@/views/ListingView/components/Gallery/Gallery.vue'
import ListingCore from '@/views/ListingView/components/ListingCore/ListingCore.vue'
import ListingComments from '@/views/ListingView/components/ListingComments/ListingComments.vue'
import CheckoutMin from '@/views/ListingView/components/Checkout/Checkout.vue'

import type { ListingParsed } from '@/views/ListingView/types/listing'

const listingData = ref<ListingParsed | null>(null)

onMounted(async () => {
  listingData.value = await listingCore()
})
</script>

<template>
  <div class="listing-view">
    <div class="gallery-container">
      <Gallery />
    </div>

    <div class="core-container">
      <Suspense>
        <ListingCore #default />
        <template #fallback>
          <div class="skeleton">Chargement…</div>
        </template>
      </Suspense>
    </div>

    <div class="stay-container">
      <Suspense>
        <ListingComments #default />
        <template #fallback>
          <div class="skeleton">Chargement…</div>
        </template>
      </Suspense>
      <template v-if="listingData">
        <CheckoutMin
          :price-per-night="listingData.bookings.price"
          :fees="listingData.bookings.fees"
          :booked-days="listingData.bookings.bookedDays"
        />
      </template>
      <template v-else>
        <div class="skeleton">Chargement…</div>
      </template>
    </div>
  </div>
</template>

<style lang="scss">
@use '@/views/ListingView/listing-view.scss';
</style>
