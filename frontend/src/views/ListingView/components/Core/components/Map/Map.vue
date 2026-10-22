<!-- File: src/views/ListingView/components/Core/components/Map/Map.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { MapPin } from 'lucide-vue-next'

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

// L'iframe Google Maps dépose des cookies tiers : elle ne se charge qu'à la demande du visiteur.
const isMapRequested = ref(false)

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

const externalMapUrl = computed(() => {
  if (!mapQuery.value) return 'https://www.google.com/maps'
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery.value)}`
})

const heading = computed(() => props.staticContent.map || props.staticContent.features)
</script>

<template>
  <section class="listing-map">
    <h2>
      {{ heading }}
    </h2>
    <iframe
      v-if="isMapRequested"
      class="frame"
      :src="mapSrc"
      title="Localisation du logement sur Google Maps"
      allowfullscreen
      loading="lazy"
      referrerpolicy="no-referrer-when-downgrade"
    >
    </iframe>
    <div
      v-else
      class="map-consent"
    >
      <button
        type="button"
        class="map-consent-button"
        @click="isMapRequested = true"
      >
        <MapPin
          :size="22"
          aria-hidden="true"
        />
        <span>Afficher la carte</span>
      </button>
      <p class="map-consent-note">
        La carte est fournie par Google, qui peut déposer des cookies (<a
          href="/legal/cookies"
          target="_blank"
          rel="noopener"
        >en savoir plus</a>). Vous pouvez aussi
        <a
          :href="externalMapUrl"
          target="_blank"
          rel="noopener"
        >ouvrir le lieu dans Google Maps</a>.
      </p>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/ListingView/components/Core/components/Map/map.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/animations' as animations;

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
    border-radius: borders.$rounded-md;
    pointer-events: auto;
    touch-action: pan-x pan-y;
    overscroll-behavior: contain;
    // overflow: hidden;
  }

  > .map-consent {
    display: flex;
    flex-direction: column;
    gap: var(--layout-gap-sm);

    > .map-consent-button {
      width: 100%;
      height: 20vh;
      min-height: 7rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--layout-gap-xs);
      border: 1px solid rgba($secondary, 0.08);
      border-radius: borders.$rounded-md;
      background-color: $accent-surface-1;
      color: $secondary-text;
      cursor: pointer;
      @include base-text($bold: true);
      @include animations.transition();
      @include animations.press(0.99);

      @include on-hover {
        background-color: $accent-surface-2;
      }

      &:focus-visible {
        outline: 2px solid $secondary;
        outline-offset: 2px;
      }
    }

    > .map-consent-note {
      @include little-text(rgba($secondary-text, 0.7), $thin: false);

      > a {
        color: inherit;
        text-decoration: underline;
        text-underline-offset: 0.2em;
      }
    }
  }
}
</style>
