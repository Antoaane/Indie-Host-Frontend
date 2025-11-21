<!-- File: src/views/ListingView/ListingView.vue -->

<script setup lang="ts">
// DEPS
import { onMounted, onBeforeUnmount } from 'vue'
import { ScrollSmoother } from 'gsap/ScrollSmoother'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import gsap from 'gsap'

// UTILS
import { vp } from '@/utils/viewport'

// COMPONENTS
import Gallery from '@/views/ListingView/components/Gallery/Gallery.vue'
import ListingCore from '@/views/ListingView/components/ListingCore/ListingCore.vue'
import ListintComments from '@/views/ListingView/components/ListintComments/ListintComments.vue'
import CheckoutMin from '@/views/ListingView/components/Checkout/Checkout.vue'
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
        <ListintComments #default />
        <template #fallback>
          <div class="skeleton">Chargement…</div>
        </template>
      </Suspense>
      <CheckoutMin />
    </div>
  </div>
</template>

<style lang="scss">
@use '@/views/ListingView/listing-view.scss';
</style>
