// File: src/views/ListingView/composables/useListingAspect.ts

import { computed, nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import type { StyleValue } from 'vue'

export type ListingViewAspect = {
  width: number
  height: number
}

export function useListingAspect(aspect: Ref<ListingViewAspect | undefined>) {
  const pvWidth = ref<number | undefined>(0)
  const pvHeight = ref<number | undefined>(0)

  const listingView = ref<HTMLElement | null>(null)
  const lvWidth = ref<number | null>(0)
  const lvHeight = ref<number | null>(0)

  const scaleDiff = ref<number | null>(0)
  const offsetX = ref<number>(0)
  const offsetY = ref<number>(0)
  let listingViewResizeObserver: ResizeObserver | null = null

  const aspectStyles = computed<StyleValue>(() => {
    if (!aspect.value) {
      return {}
    }

    return {
      aspectRatio: `${pvWidth.value} / ${pvHeight.value}`,
      transform: `translate(${offsetX.value}px, ${offsetY.value}px) scale(${scaleDiff.value})`,
      transformOrigin: 'top left',
      position: 'absolute',
      top: 0,
      left: 0,
    }
  })

  function setAspect() {
    pvWidth.value = aspect.value?.width
    pvHeight.value = aspect.value?.height

    const container = listingView.value
    if (container) {
      lvWidth.value = container.clientWidth
      lvHeight.value = container.clientHeight
    }

    if (lvWidth.value && pvWidth.value && lvHeight.value && pvHeight.value) {
      const widthScale = pvWidth.value / lvWidth.value
      const heightScale = pvHeight.value / lvHeight.value
      const nextScale = Math.min(widthScale, heightScale)

      scaleDiff.value = nextScale
      offsetX.value = Math.max(0, (pvWidth.value - (lvWidth.value * nextScale)) / 2)
      offsetY.value = Math.max(0, (pvHeight.value - (lvHeight.value * nextScale)) / 2)
    }
  }

  watch(
    () => aspect.value,
    async (value) => {
      if (!value) return
      await nextTick()
      setAspect()
    },
    { immediate: true },
  )

  watch(
    listingView,
    (element) => {
      listingViewResizeObserver?.disconnect()
      listingViewResizeObserver = null

      if (!element || typeof ResizeObserver === 'undefined') return

      listingViewResizeObserver = new ResizeObserver(() => {
        setAspect()
      })
      listingViewResizeObserver.observe(element)
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    listingViewResizeObserver?.disconnect()
    listingViewResizeObserver = null
  })

  return {
    listingView,
    aspectStyles,
  }
}
