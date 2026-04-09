<!-- File: src/views/ListingView/components/Gallery/components/Mosaic/Mosaic.vue -->

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import Tile from '@/views/ListingView/components/Gallery/components/Tile.vue'
// Utils
import { clamp, randInt, rand, boundedRandAround } from '@/views/ListingView/components/Gallery/utils/math'
import type { Rect, Slot, Item, Ori } from '@/views/ListingView/components/Gallery/utils/types'
import { generateLayout } from '@/views/ListingView/components/Gallery/utils/layout'
import { preloadOrientations } from '@/views/ListingView/components/Gallery/utils/orientation'
import { tileStyle, TINY_RECT } from '@/views/ListingView/components/Gallery/utils/style'
import { fancyboxShow } from '@/views/ListingView/components/Gallery/utils/fancybox'
import { orderByIndex } from '@/views/ListingView/components/Gallery/utils/order'

const props = defineProps<{
  items: Item[] // Maintenant obligatoire
  lightboxItems?: Item[]
  intervalMs?: number
  minSlots?: number
  maxSlots?: number
  minTileW?: number
  minTileH?: number
}>()

// Tri par index si présent (ordre d'apparition)
const orderedItems = computed<Item[]>(() => orderByIndex(props.items))
const lightboxItems = computed<Item[]>(() => props.lightboxItems ?? props.items)
const orderedLightboxItems = computed<Item[]>(() => orderByIndex(lightboxItems.value))

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

// curseur d'apparition (respecte `index`)
let appearanceCursor = 0

// pour l'orientation native
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

  const x = Math.round(boundedRandAround(prevX, 0, 100, 50, 30))
  const y = Math.round(boundedRandAround(prevY, 40, 60, 10, 5))

  lastX[idx] = x
  lastY[idx] = y
  return `${x}% ${y}%`
}

/* --------------------------
    Main logic
---------------------------*/

/** Kick initial : déclenche une première transition d'object-position au 1er rendu */
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
  imgOri.value = preloadOrientations(props.items, (idx, ori) => {
    imgOri.value[idx] = ori
  })
}

function nextLayout() {
  if (!orderedItems.value.length || !props.items.length) {
    slots.splice(0, slots.length)
    appearanceCursor = 0
    return
  }

  const visibleCount = randInt(minSlots.value, maxSlots.value)
  const layout = generateLayout(visibleCount, minTileW.value, minTileH.value)

  // images visibles pour ce cycle, **dans l'ordre** (index)
  const visibles: Item[] = []
  for (let i = 0; i < visibleCount; i++) {
    const it = orderedItems.value[(appearanceCursor + i) % orderedItems.value.length]
    visibles.push(it)
  }
  appearanceCursor = (appearanceCursor + 1) % orderedItems.value.length

  // map -> index réels (dans props.items)
  const realIndexOf = (it: Item) => props.items.findIndex((x) => x.src === it.src)
  const visibleIdxs = visibles.map(realIndexOf).filter((i) => i >= 0)

  assignLayoutToAll(layout, visibleIdxs)
}

function assignLayoutToAll(rects: Rect[], visibleReal: number[]) {
  // (re)init des slots : un par image
  const needInit = slots.length !== props.items.length
  if (needInit) {
    slots.splice(0, slots.length)
    lastX.length = 0
    lastY.length = 0

    for (let i = 0; i < props.items.length; i++) {
      const firstPos = initObjPosFor(i) // position initiale (peinte à F0)
      const newSlot: Slot = {
        id: nextId++,
        rect: TINY_RECT, // safe rect par défaut
        imageIndex: i,
        objPos: firstPos,
      }
      slots.push(newSlot)
    }
  }

  const rectsForCycle = rects.slice(0, visibleReal.length)

  // Utiliser nextTick/rAF pour garantir que Vue a terminé le rendu initial
  if (needInit) {
    // Attendre le prochain tick avant d'initialiser les rects
    requestAnimationFrame(() => {
      for (let i = 0; i < slots.length; i++) {
        const pos = visibleReal.indexOf(i)
        if (pos >= 0) {
          slots[i].rect = rectsForCycle[pos]
        } else {
          slots[i].rect = TINY_RECT
        }
      }
      // déclenchement du 1er mouvement après assignation
      kickInitialObjPos()
    })
  } else {
    // Mise à jour normale
    for (let i = 0; i < slots.length; i++) {
      const pos = visibleReal.indexOf(i)
      if (pos >= 0) {
        slots[i].rect = rectsForCycle[pos]
      } else {
        slots[i].rect = TINY_RECT
      }
      slots[i].objPos = newObjPosFor(i, false)
    }
  }
}

/* --------------------------
    Lifecycle
---------------------------*/

function start() {
  if (!orderedItems.value.length || !props.items.length) {
    stop()
    return
  }
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
    () => props.items.length,
  ],
  () => {
    refreshOrientations()
    start()
  },
)

function openLightbox(startIndexReal: number) {
  const clicked = props.items[startIndexReal]
  if (!clicked) return

  // Lightbox dans l'ordre `index`
  const items = orderedLightboxItems.value.map((it) => ({ src: it.src, type: 'image', alt: it.alt }))
  const startIndex = Math.max(
    0,
    orderedLightboxItems.value.findIndex((i) => i.src === clicked.src),
  )
  fancyboxShow(items, startIndex)
}
</script>

<template>
  <div
    v-if="slots.length > 0"
    class="listing-gallery-mosaic"
    ref="container"
  >
    <Tile
      v-for="slot in slots"
      :key="slot.id"
      :style-obj="tileStyle(slot.rect || TINY_RECT, GAP_PX)"
      :src="props.items[slot.imageIndex % props.items.length]?.src"
      :alt="props.items[slot.imageIndex % props.items.length]?.alt"
      :obj-pos="slot.objPos"
      @click="openLightbox(slot.imageIndex % props.items.length)"
    />
  </div>
</template>

<style lang="scss">
/* File: src/views/ListingView/components/Gallery/components/Mosaic/mosaic.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.listing-gallery-mosaic {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
  width: 100%;
  // height: 100%;
  overflow: hidden;
  border-bottom-left-radius: borders.$rounded-lg;
  border-bottom-right-radius: borders.$rounded-lg;
  border-top-left-radius: 5px;
  border-top-right-radius: 5px;
}
</style>
