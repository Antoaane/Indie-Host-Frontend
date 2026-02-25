// File: src/utils/medias/order.ts

export type IndexableMedia = {
  position?: number | null
  index?: number | null
}

export function orderByIndex<T extends IndexableMedia>(items: T[]): T[] {
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

