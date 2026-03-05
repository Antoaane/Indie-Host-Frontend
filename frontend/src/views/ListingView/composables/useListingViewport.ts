// File: src/views/ListingView/composables/useListingViewport.ts

import { computed, inject, provide, type ComputedRef, type InjectionKey } from 'vue'

import { vp } from '@/utils/viewport'

export type ListingViewportMode = 'xxl' | 'lg' | 'sm'

type ListingViewportContext = {
  mode: ComputedRef<ListingViewportMode | null>
  isLg: ComputedRef<boolean>
}

const listingViewportContextKey: InjectionKey<ListingViewportContext> = Symbol('listingViewportContext')

function resolveIsLg(mode: ListingViewportMode | null): boolean {
  if (!mode) return vp.lg.value
  return mode === 'xxl'
}

export function provideListingViewportMode(mode: ComputedRef<ListingViewportMode | null>) {
  const isLg = computed(() => resolveIsLg(mode.value))
  provide(listingViewportContextKey, {
    mode,
    isLg,
  })
}

export function useListingViewport() {
  const context = inject(listingViewportContextKey, null)

  const mode = computed<ListingViewportMode | null>(() => {
    if (context) return context.mode.value
    return null
  })

  const isLg = computed(() => {
    if (context) return context.isLg.value
    return vp.lg.value
  })

  return {
    mode,
    isLg,
  }
}
