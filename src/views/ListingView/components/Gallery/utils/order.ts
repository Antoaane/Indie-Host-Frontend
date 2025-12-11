// File: src/views/ListingView/components/Gallery/utils/order.ts

import type { Item } from '@/views/ListingView/components/Gallery/utils/types'

export function orderByIndex(items: Item[]): Item[] {
  const arr = [...items]
  const hasPosition = arr.some((i) => typeof i.position === 'number')
  const hasIndex = arr.some((i) => typeof i.index === 'number')

  if (hasPosition || hasIndex) {
    arr.sort((a, b) => {
      const aOrder = hasPosition ? (a.position ?? Number.POSITIVE_INFINITY) : (a.index ?? 0)
      const bOrder = hasPosition ? (b.position ?? Number.POSITIVE_INFINITY) : (b.index ?? 0)
      return aOrder - bOrder
    })
  }
  return arr
}
