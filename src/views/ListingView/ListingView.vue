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
import ListingCore from './components/ListingCore/ListingCore.vue'
import Comments from './components/Comments/Comments.vue'
import CheckoutMin from './components/Checkout/Checkout.vue'
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
      <Comments />
      <CheckoutMin />
    </div>
  </div>
</template>

<style lang="scss">
@use '@/views/ListingView/listing-view.scss';
</style>
