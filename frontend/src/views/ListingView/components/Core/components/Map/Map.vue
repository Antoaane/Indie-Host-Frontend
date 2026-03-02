<!-- File: src/views/ListingView/components/Core/components/Map/Map.vue -->

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  latitude: number
  longitude: number
  zoom?: number
  query?: string
  staticContent: {
    features: string
    availability: string
    map?: string
  }
}>()

const mapQuery = computed(() => {
  const query = String(props.query ?? '').trim()
  if (query) return query

  if (Number.isFinite(props.latitude) && Number.isFinite(props.longitude)) {
    return `${props.latitude},${props.longitude}`
  }

  return ''
})

const mapSrc = computed(() => {
  const zoom = props.zoom ?? 15
  if (!mapQuery.value) {
    return `https://www.google.com/maps?hl=fr&z=${zoom}&output=embed`
  }
  return `https://www.google.com/maps?hl=fr&q=${encodeURIComponent(mapQuery.value)}&z=${zoom}&output=embed`
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
      title="Localisation du logement sur Google Maps"
      allowfullscreen
      loading="lazy"
      referrerpolicy="no-referrer-when-downgrade"
    >
    </iframe>
  </section>
</template>

<style lang="scss">
/* File: src/views/ListingView/components/Core/components/Map/map.scss */

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
    display: block;
    height: 20vh;
    border: 0;
    border-radius: 12px;
    pointer-events: auto;
    touch-action: pan-x pan-y;
    overscroll-behavior: contain;
    // overflow: hidden;
  }
}
</style>
