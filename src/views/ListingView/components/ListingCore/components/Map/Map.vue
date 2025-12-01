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
  <div class="map-listing__comp">
    <h2>
      {{ heading }}
    </h2>
    <iframe
      class="map-frame"
      :src="mapSrc"
      loading="lazy"
      referrerpolicy="no-referrer-when-downgrade"
    >
    </iframe>
  </div>
</template>

<style lang="scss">
@use '@/views/ListingView/components/ListingCore/components/Map/map.scss';
</style>
