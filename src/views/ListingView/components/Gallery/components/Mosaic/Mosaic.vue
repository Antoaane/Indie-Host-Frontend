<!-- File: src/views/ListingView/components/Gallery/components/Mosaic/Mosaic.vue -->

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import Tile from '@/views/ListingView/components/Gallery/components/Tile.vue'
// Utils
import { clamp, randInt, rand, boundedRandAround } from '@/views/ListingView/components/Gallery/utils/math'
import type { Rect, Slot, Item, Ori } from '@/views/ListingView/components/Gallery/utils/types'
import { generateLayout } from '@/views/ListingView/components/Gallery/utils/layout'
import { preloadOrientations, rectToOri } from '@/views/ListingView/components/Gallery/utils/orientation'
import { tileStyle } from '@/views/ListingView/components/Gallery/utils/style'
import { fancyboxShow } from '@/views/ListingView/components/Gallery/utils/fancybox'

const props = defineProps<{
  items?: Item[]
  intervalMs?: number
  minSlots?: number
  maxSlots?: number
  minTileW?: number
  minTileH?: number
}>()

// Images par défaut (fixes) — avec index pour l’ordre d’apparition
const DEFAULT_IMAGES: Item[] = [
  { image: '/assets/media/images/listing-test/image0.jpg', alt: '0', index: 0 },
  { image: '/assets/media/images/listing-test/image1.jpg', alt: '1', index: 1 },
  { image: '/assets/media/images/listing-test/image2.jpg', alt: '2', index: 2 },
  { image: '/assets/media/images/listing-test/image3.jpg', alt: '3', index: 3 },
  { image: '/assets/media/images/listing-test/image4.jpg', alt: '4', index: 4 },
  { image: '/assets/media/images/listing-test/image5.jpg', alt: '5', index: 5 },
  { image: '/assets/media/images/listing-test/image6.jpg', alt: '6', index: 6 },
  { image: '/assets/media/images/listing-test/image7.jpg', alt: '7', index: 7 },
  { image: '/assets/media/images/listing-test/image8.jpg', alt: '8', index: 8 },
  { image: '/assets/media/images/listing-test/image9.jpg', alt: '9', index: 9 },
  { image: '/assets/media/images/listing-test/image10.jpg', alt: '10', index: 10 },
]

const resolvedItems = computed<Item[]>(() => (props.items?.length ? props.items : DEFAULT_IMAGES))

// Tri par index si présent (ordre d’apparition)
const orderedItems = computed<Item[]>(() => {
  const arr = [
    ...resolvedItems.value,
  ]
  if (arr.some((i) => typeof i.index === 'number')) {
    arr.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
  }
  return arr
})

const intervalMs = computed(() => props.intervalMs ?? 2000)
const minSlots = computed(() => Math.max(2, props.minSlots ?? 2))
const maxSlots = computed(() => Math.max(minSlots.value, props.maxSlots ?? 4))
const minTileW = computed(() => clamp(props.minTileW ?? 18, 4, 100))
const minTileH = computed(() => clamp(props.minTileH ?? 14, 4, 100))

// gap visuel (px)
const GAP_PX = 7.5
const container = ref<HTMLElement | null>(null)

// ———————————————————————————————————————————————
// object-position : état PAR IMAGE (indépendant)
// ———————————————————————————————————————————————
const lastX: number[] = [] // pourcentages 0..100
const lastY: number[] = []

// Un slot **par image** — elles restent toutes montées en permanence
const slots = reactive<Slot[]>([])
let nextId = 0
let timer: number | null = null

// curseur d’apparition (respecte `index`)
let appearanceCursor = 0

// pour l’orientation native
const imgOri = ref<Ori[]>([])

/* --------------------------
   Helpers object-position
---------------------------*/

function initObjPosFor(idx: number) {
  // première apparition : valeur aléatoire NON extrême (et indépendante des autres)
  lastX[idx] = Math.round(rand(20, 80))
  lastY[idx] = Math.round(rand(40, 60))
  return `${lastX[idx]}% ${lastY[idx]}%`
}

/**
 * Favorise mouvement horizontal, borné, et variation limitée :
 * - X ∈ [20, 80], ΔX ≤ 18%, ΔX ≥ 6% (au 1er tick on évite de rester collé à la même valeur)
 * - Y ∈ [40, 60], ΔY ≤ 8%,  ΔY ≥ 2%
 */
function newObjPosFor(idx: number, first = false) {
  const prevX = lastX[idx] ?? 50
  const prevY = lastY[idx] ?? 50

  const x = Math.round(boundedRandAround(prevX, 20, 80, 18, first ? 6 : 3))
  const y = Math.round(boundedRandAround(prevY, 40, 60, 8, first ? 2 : 1))

  lastX[idx] = x
  lastY[idx] = y
  return `${x}% ${y}%`
}

/* --------------------------
    Main logic
---------------------------*/

/** Kick initial : déclenche une première transition d’object-position au 1er rendu */
function kickInitialObjPos() {
  // double rAF pour garantir que le premier style est peint, puis on modifie
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      for (let i = 0; i < slots.length; i++) {
        // on force une vraie variation (minDelta > 0)
        slots[i].objPos = newObjPosFor(i, true)
      }
    })
  })
}

function refreshOrientations() {
  imgOri.value = preloadOrientations(resolvedItems.value, (idx, ori) => {
    imgOri.value[idx] = ori
  })
}

function nextLayout() {
  const visibleCount = randInt(minSlots.value, maxSlots.value)
  const layout = generateLayout(visibleCount, minTileW.value, minTileH.value)

  // images visibles pour ce cycle, **dans l’ordre** (index)
  const visibles: Item[] = []
  for (let i = 0; i < visibleCount; i++) {
    const it = orderedItems.value[(appearanceCursor + i) % orderedItems.value.length]
    visibles.push(it)
  }
  appearanceCursor = (appearanceCursor + 1) % orderedItems.value.length

  // map -> index réels (dans resolvedItems)
  const realIndexOf = (it: Item) => resolvedItems.value.findIndex((x) => x.image === it.image)
  const visibleIdxs = visibles.map(realIndexOf).filter((i) => i >= 0)

  assignLayoutToAll(layout, visibleIdxs)
}

function assignLayoutToAll(rects: Rect[], visibleReal: number[]) {
  // (re)init des slots : un par image
  const needInit = slots.length !== resolvedItems.value.length
  if (needInit) {
    slots.splice(0, slots.length)
    lastX.length = 0
    lastY.length = 0

    for (let i = 0; i < resolvedItems.value.length; i++) {
      const firstPos = initObjPosFor(i) // position initiale (peinte à F0)
      slots.push({
        id: nextId++,
        rect: { x: 50, y: 50, w: 0.0001, h: 0.0001 },
        imageIndex: i,
        objPos: firstPos,
      })
    }
  }

  const rectsForCycle = rects.slice(0, visibleReal.length)
  for (let i = 0; i < slots.length; i++) {
    const pos = visibleReal.indexOf(i)
    if (pos >= 0) {
      // visible → prend un vrai rect
      slots[i].rect = rectsForCycle[pos]
    } else {
      // invisible → se réduit au centre
      slots[i].rect = { x: 50, y: 50, w: 0.0001, h: 0.0001 }
    }
    // variations continues (minDelta faible après le kick)
    if (!needInit) {
      slots[i].objPos = newObjPosFor(i, false)
    }
  }

  // si on vient d'initialiser, on déclenche le 1er mouvement immédiatement
  if (needInit) {
    kickInitialObjPos()
  }
}

/* --------------------------
    Lifecycle
---------------------------*/

function start() {
  nextLayout()
  stop()
  timer = window.setInterval(() => nextLayout(), intervalMs.value) as unknown as number
}
function stop() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function handleVisibility() {
  if (document.visibilityState === 'visible') start()
  else stop()
}

onMounted(() => {
  refreshOrientations()
  start()
  window.addEventListener('visibilitychange', handleVisibility)
})
onBeforeUnmount(() => {
  stop()
  window.removeEventListener('visibilitychange', handleVisibility)
})

watch(
  [
    intervalMs,
    minSlots,
    maxSlots,
    () => resolvedItems.value.length,
  ],
  () => {
    refreshOrientations()
    start()
  },
)

function openLightbox(startIndexReal: number) {
  // Lightbox dans l’ordre `index`
  const items = orderedItems.value.map((it) => ({ src: it.image, type: 'image', alt: it.alt }))
  const clicked = resolvedItems.value[startIndexReal]
  const startIndex = Math.max(
    0,
    orderedItems.value.findIndex((i) => i.image === clicked.image),
  )
  fancyboxShow(items, startIndex)
}
</script>

<template>
  <div
    class="mosaic-container"
    ref="container"
  >
    <Tile
      v-for="slot in slots"
      :key="slot.id"
      :style-obj="tileStyle(slot.rect, GAP_PX)"
      :src="resolvedItems[slot.imageIndex % resolvedItems.length]?.image"
      :alt="resolvedItems[slot.imageIndex % resolvedItems.length]?.alt"
      :obj-pos="slot.objPos"
      @click="openLightbox(slot.imageIndex % resolvedItems.length)"
    />
  </div>
</template>

<style lang="scss" src="./mosaic.scss"></style>
