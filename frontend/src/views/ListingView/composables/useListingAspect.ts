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

  const scaleDiff = ref<number>(1)
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

  function resolveFallbackPreviewSize(containerWidth: number, containerHeight: number) {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : containerWidth / 0.9
    const baseWidth = Math.max(1, viewportWidth * 0.9)
    const ratio = containerWidth > 0 && containerHeight > 0 ? containerHeight / containerWidth : 9 / 16
    const baseHeight = Math.max(1, baseWidth * ratio)

    return {
      width: baseWidth,
      height: baseHeight,
    }
  }

  function setAspect() {
    const nextWidth = Number(aspect.value?.width ?? 0)
    const nextHeight = Number(aspect.value?.height ?? 0)
    if (!Number.isFinite(nextWidth) || !Number.isFinite(nextHeight) || nextWidth <= 0 || nextHeight <= 0) return

    pvWidth.value = nextWidth
    pvHeight.value = nextHeight

    const container = listingView.value
    if (container) {
      lvWidth.value = container.clientWidth
      lvHeight.value = container.clientHeight
    }

    const fallback = resolveFallbackPreviewSize(nextWidth, nextHeight)
    const baseWidth = Number(lvWidth.value) > 0 ? Number(lvWidth.value) : fallback.width
    const baseHeight = Number(lvHeight.value) > 0 ? Number(lvHeight.value) : fallback.height

    const widthScale = nextWidth / baseWidth
    const heightScale = nextHeight / baseHeight
    const nextScale = Math.min(widthScale, heightScale)

    scaleDiff.value = nextScale
    offsetX.value = Math.max(0, (nextWidth - (baseWidth * nextScale)) / 2)
    offsetY.value = Math.max(0, (nextHeight - (baseHeight * nextScale)) / 2)
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

      setAspect()
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    listingViewResizeObserver?.disconnect()
    listingViewResizeObserver = null
  })

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', setAspect)
  }

  onBeforeUnmount(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', setAspect)
    }
  })

  return {
    listingView,
    aspectStyles,
  }
}
