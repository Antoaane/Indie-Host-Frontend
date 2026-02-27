// File: src/views/ListingView/composables/useListingAspect.ts

import { computed, nextTick, ref, watch, type Ref } from 'vue'
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

  const aspectStyles = computed<StyleValue>(() => {
    if (!aspect.value) {
      return {}
    }

    return {
      aspectRatio: `${pvWidth.value} / ${pvHeight.value}`,
      transform: `scale(${scaleDiff.value})`,
      transformOrigin: 'top left',
      position: 'relative',
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
      scaleDiff.value = pvWidth.value / lvWidth.value
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

  return {
    listingView,
    aspectStyles,
  }
}
