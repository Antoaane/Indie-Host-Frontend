// File: src/views/ListingView/components/Gallery/utils/order.ts

import type { Item } from '@/views/ListingView/components/Gallery/utils/types'

export function orderByIndex(items: Item[]): Item[] {
  const arr = [...items]
  if (arr.some((i) => typeof i.index === 'number')) {
    arr.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
  }
  return arr
}
