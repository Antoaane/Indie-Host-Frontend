<!-- File: src/views/ListingView/components/Core/components/Map/Map.vue -->

<script setup lang="ts">
// Carte du logement, affichée d'emblée (elle demandait un clic sur « Afficher la carte »).
//
// - Fond de carte OpenFreeMap (Hyperknot, Hongrie : ni cookie, ni clé, usage commercial permis),
//   dessiné par MapLibre GL. Aucun traceur, donc pas de consentement à demander, contrairement à
//   l'ancienne carte Google, qui déposait ses cookies.
// - Zone approximative (cercle de 300 m) et non l'adresse : comme sur Airbnb, l'adresse exacte
//   n'est donnée qu'après la réservation (guide d'arrivée). Le centre du cercle est décalé de
//   quelques dizaines de mètres, toujours le même pour un logement, pour ne pas désigner la porte.
// - MapLibre (≈ 300 Ko compressés) n'est chargé qu'à l'approche de la carte.
// - Au doigt, la carte ne bouge pas (elle volerait le défilement de la page) : « Ouvrir dans Plans »
//   ouvre l'application de cartes du téléphone sur la même zone.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { MapPin } from 'lucide-vue-next'
import type { Map as MapLibreMap } from 'maplibre-gl'

const props = defineProps<{
  latitude: number
  longitude: number
  zoom?: number
  query?: string
  /** Ville, pays : seul le lieu est écrit, jamais l'adresse. */
  placeLabel?: string
  staticContent: {
    features: string
    availability: string
    map?: string
  }
}>()

// « liberty » : mer en bleu, parcs en vert, comme une carte habituelle. « positron » (gris) rendait la
// mer de la même couleur que la terre, peu parlant pour un logement en bord de mer.
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const AREA_RADIUS_METERS = 300
const AREA_OFFSET_METERS = 120
const MAP_ZOOM = 14

const container = ref<HTMLElement | null>(null)
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
let map: MapLibreMap | null = null
let observer: IntersectionObserver | null = null

const heading = computed(() => props.staticContent.map || props.staticContent.features)
const placeLabel = computed(() => String(props.placeLabel ?? '').trim())

const hasCoordinates = computed(() =>
  Number.isFinite(props.latitude)
  && Number.isFinite(props.longitude)
  && !(props.latitude === 0 && props.longitude === 0),
)

// Décalage stable : même logement, même cercle.
function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const areaCenter = computed(() => {
  const seed = hashString(`${props.latitude.toFixed(5)}:${props.longitude.toFixed(5)}`)
  const angle = ((seed % 360) * Math.PI) / 180
  const distance = AREA_OFFSET_METERS * (0.4 + ((seed >>> 9) % 600) / 1000)
  const latitude = props.latitude + (distance * Math.cos(angle)) / 111_320
  const longitude = props.longitude + (distance * Math.sin(angle)) / (111_320 * Math.cos((props.latitude * Math.PI) / 180))
  return { latitude, longitude }
})

function circlePolygon(latitude: number, longitude: number, radiusMeters: number, steps = 64) {
  const coordinates: [number, number][] = []
  const latRadius = radiusMeters / 111_320
  const lngRadius = radiusMeters / (111_320 * Math.cos((latitude * Math.PI) / 180))
  for (let step = 0; step <= steps; step += 1) {
    const angle = (step / steps) * 2 * Math.PI
    coordinates.push([longitude + lngRadius * Math.cos(angle), latitude + latRadius * Math.sin(angle)])
  }
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [coordinates] },
  }
}

const isApplePlatform = typeof navigator !== 'undefined'
  && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

const externalMap = computed(() => {
  const label = placeLabel.value || 'Logement'
  if (hasCoordinates.value) {
    const { latitude, longitude } = areaCenter.value
    const point = `${latitude.toFixed(5)},${longitude.toFixed(5)}`
    return isApplePlatform
      ? { label: 'Ouvrir dans Plans', url: `https://maps.apple.com/?ll=${point}&z=${MAP_ZOOM}&q=${encodeURIComponent(label)}` }
      : { label: 'Ouvrir dans Google Maps', url: `https://www.google.com/maps/search/?api=1&query=${point}` }
  }
  if (!placeLabel.value) return null
  return { label: 'Ouvrir dans une carte', url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeLabel.value)}` }
})

async function mountMap() {
  const element = container.value
  if (!element || map) return
  status.value = 'loading'

  try {
    const [maplibre, worker] = await Promise.all([
      import('maplibre-gl'),
      import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'),
      import('maplibre-gl/dist/maplibre-gl.css'),
    ])
    // Sous Vite, MapLibre ne retrouve pas seul son « worker » : on lui donne son adresse.
    maplibre.setWorkerUrl(worker.default)

    const finePointer = window.matchMedia('(pointer: fine)').matches
    const { latitude, longitude } = areaCenter.value
    // Couleur de la zone : celle du texte de la page (jeton du thème), lue sur la carte elle-même.
    const ink = getComputedStyle(element).color || 'rgb(17, 17, 23)'

    map = new maplibre.Map({
      container: element,
      style: MAP_STYLE_URL,
      center: [longitude, latitude],
      zoom: MAP_ZOOM,
      // Au doigt, pas de geste sur la carte : elle volerait le défilement de la page.
      interactive: finePointer,
      cooperativeGestures: finePointer,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: { compact: true },
      fadeDuration: 0,
    })

    if (finePointer) {
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right')
    }

    map.on('load', () => {
      if (!map) return
      status.value = 'ready'
      try {
        map.addSource('listing-area', {
          type: 'geojson',
          data: circlePolygon(latitude, longitude, AREA_RADIUS_METERS),
        })
        map.addLayer({
          id: 'listing-area-fill',
          type: 'fill',
          source: 'listing-area',
          paint: { 'fill-color': ink, 'fill-opacity': 0.12 },
        })
        map.addLayer({
          id: 'listing-area-line',
          type: 'line',
          source: 'listing-area',
          paint: { 'line-color': ink, 'line-width': 1.5, 'line-opacity': 0.55 },
        })
      } catch (error) {
        // Sans la zone, la carte reste utile : elle s'affiche quand même.
        console.warn('[ListingMap] zone non dessinée', error)
      }
    })

    // Seule une erreur qui empêche la carte de naître (style ou worker introuvable) la remplace par
    // le message : une tuile ou une icône manquante ne doit pas la masquer.
    map.on('error', (event) => {
      if (status.value === 'ready') return
      const detail = event as { sourceId?: string; tile?: unknown }
      if (detail.sourceId || detail.tile) return
      console.warn('[ListingMap] carte indisponible', event.error)
      status.value = 'error'
      // Arrêtée après l'événement en cours : MapLibre réessaierait sinon en boucle.
      const failedMap = map
      map = null
      window.setTimeout(() => failedMap?.remove(), 0)
    })
  } catch (error) {
    console.warn('[ListingMap] carte indisponible', error)
    status.value = 'error'
  }
}

onMounted(() => {
  if (!hasCoordinates.value || !container.value) return

  if (typeof IntersectionObserver === 'undefined') {
    void mountMap()
    return
  }

  observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer?.disconnect()
      observer = null
      void mountMap()
    },
    { rootMargin: '600px 0px' },
  )
  observer.observe(container.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  map?.remove()
  map = null
})
</script>

<template>
  <section class="listing-map">
    <h2>
      {{ heading }}
    </h2>
    <p
      v-if="placeLabel"
      class="place"
    >
      {{ placeLabel }}
    </p>

    <div
      v-if="hasCoordinates"
      class="frame"
      :class="`is-${status}`"
    >
      <div
        ref="container"
        class="canvas"
        role="img"
        :aria-label="placeLabel ? `Carte : environs du logement, ${placeLabel}` : 'Carte : environs du logement'"
      />
      <p
        v-if="status === 'error'"
        class="fallback"
      >
        <MapPin
          :size="20"
          aria-hidden="true"
        />
        <span>La carte n’a pas pu s’afficher.</span>
      </p>
    </div>

    <div class="meta">
      <p class="note">Emplacement approximatif. L’adresse exacte vous est communiquée après la réservation.</p>
      <a
        v-if="externalMap"
        class="external"
        :href="externalMap.url"
        target="_blank"
        rel="noopener"
      >
        {{ externalMap.label }}<span class="sr-only"> (nouvel onglet)</span>
      </a>
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
    margin-bottom: var(--layout-gap-2xs) !important;
    @include h2-title($gradiant: true);
  }

  > .place {
    margin-bottom: var(--layout-gap-md);
    @include base-text(rgba($secondary-text, 0.75), $thin: false);
  }

  > .frame {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 10;
    max-height: 22rem;
    overflow: hidden;

    border-radius: borders.$rounded-md;
    background-color: $accent-surface-1;
    // Couleur lue par la carte pour dessiner la zone.
    color: $secondary-text;

    > .canvas {
      position: absolute;
      inset: 0;
      opacity: 0;
      @include animations.transition(animations.$duration-base, animations.$ease-out, opacity);
    }

    &.is-ready > .canvas {
      opacity: 1;
    }

    > .fallback {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--layout-gap-xs);
      @include little-text(rgba($secondary-text, 0.7), $thin: false);
    }

    // Mention des sources de la carte, discrète.
    .maplibregl-ctrl-attrib {
      @include little-text(rgba($secondary-text, 0.7), $thin: false);
      font-size: 0.6875rem;
    }
  }

  > .meta {
    margin-top: var(--layout-gap-sm);
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--layout-gap-xs) var(--layout-gap);

    > .note {
      flex: 1 1 14rem;
      @include little-text(rgba($secondary-text, 0.7), $thin: false);
    }

    > .external {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      min-height: var(--tap-target);
      @include base-text($bold: true, $underline: true);

      &:focus-visible {
        outline: 2px solid $secondary;
        outline-offset: 2px;
        border-radius: borders.$rounded-xs;
      }
    }
  }
}
</style>
