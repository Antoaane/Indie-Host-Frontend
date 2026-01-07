<!-- File: src/views/ListingView/components/ListingCore/components/Map/Map.vue -->

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  latitude: number
  longitude: number
  zoom?: number
  staticContent: {
    features: string
    availability: string
    map?: string
  }
}>()

const mapSrc = computed(() => {
  const zoom = props.zoom ?? 15
  return `https://www.google.com/maps?q=${props.latitude},${props.longitude}&z=${zoom}&output=embed`
})

const heading = computed(() => props.staticContent.map || props.staticContent.features)
</script>

<template>
  <section class="listing-map">
    <h2>
      {{ heading }}
    </h2>
    <iframe
      class="frame"
      :src="mapSrc"
      loading="lazy"
      referrerpolicy="no-referrer-when-downgrade"
    >
    </iframe>
  </section>
</template>

<style lang="scss">
/* File: src/views/ListingView/components/ListingCore/components/Map/map.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.listing-map {
  > h2 {
    margin-bottom: var(--layout-gap-md) !important;
    @include h2-title($gradiant: true);
  }

  > .frame {
    width: 100%;
    max-width: 100%;
    height: 20vh;
    border: 0;
    border-radius: 12px;
    // overflow: hidden;
  }
}
</style>
