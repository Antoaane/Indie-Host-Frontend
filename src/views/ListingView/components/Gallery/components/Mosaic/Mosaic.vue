<!-- File: src/views/ListingView/components/Gallery/components/Mosaic/Mosaic.vue -->

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import Tile from '@/views/ListingView/components/Gallery/components/Tile.vue'
// Utils
import { clamp, rand, randInt, pick } from '@/views/ListingView/components/Gallery/utils/math'
import type { Rect, Slot, Item, Ori } from '@/views/ListingView/components/Gallery/utils/types'
import { generateLayout } from '@/views/ListingView/components/Gallery/utils/layout'
import { classifyAspect, preloadOrientations, rectToOri } from '@/views/ListingView/components/Gallery/utils/orientation'
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

// Images par défaut (fixes)
const DEFAULT_IMAGES: Item[] = [
  { image: '/assets/media/images/listing-test/image0.jpg', alt: '0' },
  { image: '/assets/media/images/listing-test/image1.jpg', alt: '1' },
  { image: '/assets/media/images/listing-test/image2.jpg', alt: '2' },
  { image: '/assets/media/images/listing-test/image3.jpg', alt: '3' },
  { image: '/assets/media/images/listing-test/image4.jpg', alt: '4' },
  { image: '/assets/media/images/listing-test/image5.jpg', alt: '5' },
  { image: '/assets/media/images/listing-test/image6.jpg', alt: '6' },
  { image: '/assets/media/images/listing-test/image7.jpg', alt: '7' },
  { image: '/assets/media/images/listing-test/image8.jpg', alt: '8' },
  { image: '/assets/media/images/listing-test/image9.jpg', alt: '9' },
  { image: '/assets/media/images/listing-test/image10.jpg', alt: '10' },
]

const resolvedItems = computed<Item[]>(() => (props.items?.length ? props.items : DEFAULT_IMAGES))
const intervalMs = computed(() => props.intervalMs ?? 2000)
const minSlots = computed(() => Math.max(2, props.minSlots ?? 2))
const maxSlots = computed(() => Math.max(minSlots.value, props.maxSlots ?? 4))
const minTileW = computed(() => clamp(props.minTileW ?? 18, 4, 100))
const minTileH = computed(() => clamp(props.minTileH ?? 14, 4, 100))

const GAP_PX = 7.5
const container = ref<HTMLElement | null>(null)

const slots = reactive<Slot[]>([])
let nextId = 0
let timer: number | null = null
let imageCursor = 0
let cursorH = 0,
  cursorV = 0,
  cursorS = 0

const imgOri = ref<Ori[]>([])

function newObjPos() {
  return pick([
    'center',
    'top',
    'bottom',
    'left',
    'right',
    '25% 50%',
    '50% 75%',
    '75% 30%',
  ])
}

function refreshOrientations() {
  imgOri.value = preloadOrientations(resolvedItems.value, (idx, ori) => {
    imgOri.value[idx] = ori
  })
}

function buildBuckets() {
  const H: number[] = [],
    V: number[] = [],
    S: number[] = []
  for (let i = 0; i < resolvedItems.value.length; i++) {
    const o = imgOri.value[i] || 'H'
    if (o === 'H') H.push(i)
    else if (o === 'V') V.push(i)
    else S.push(i)
  }
  return { H, V, S }
}

function nextLayout() {
  const visibleCount = randInt(minSlots.value, maxSlots.value)
  const layout = generateLayout(visibleCount, minTileW.value, minTileH.value)

  const buckets = buildBuckets()
  const images: number[] = []

  const pop = (list: number[], cursorRef: 'H' | 'V' | 'S'): number | null => {
    if (!list.length) return null
    let cursor = cursorRef === 'H' ? cursorH : cursorRef === 'V' ? cursorV : cursorS
    const idx = list[cursor % list.length]
    if (cursorRef === 'H') cursorH++
    else if (cursorRef === 'V') cursorV++
    else cursorS++
    return idx
  }

  for (const r of layout) {
    const need = rectToOri(r)
    let chosen: number | null = null
    if (need === 'H') {
      chosen = pop(buckets.H, 'H') ?? pop(buckets.S, 'S')
    } else if (need === 'V') {
      chosen = pop(buckets.V, 'V') ?? pop(buckets.S, 'S')
    } else {
      chosen = pop(buckets.S, 'S')
      if (chosen == null) {
        if (buckets.H.length >= buckets.V.length) chosen = pop(buckets.H, 'H')
        else chosen = pop(buckets.V, 'V')
      }
    }
    if (chosen == null) {
      chosen = imageCursor++ % resolvedItems.value.length
    }
    images.push(chosen)
  }

  imageCursor = imageCursor % resolvedItems.value.length
  applyLayout(layout, images)
}

function applyLayout(rects: Rect[], imageIndexes: number[]) {
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]
    if (slots[i]) {
      slots[i].rect = r
      slots[i].imageIndex = imageIndexes[i]
      slots[i].objPos = newObjPos()
    } else {
      slots.push({ id: nextId++, rect: r, imageIndex: imageIndexes[i], objPos: newObjPos() })
    }
  }
  while (slots.length > rects.length) slots.pop()
}

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

function openLightbox(startIndex: number) {
  const items = resolvedItems.value.map((it) => ({ src: it.image, type: 'image', alt: it.alt }))
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
