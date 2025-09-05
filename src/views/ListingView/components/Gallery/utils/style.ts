// File: src/views/ListingView/components/Gallery/utils/style.ts

import type { Rect } from '@/views/ListingView/components/Gallery/utils/types'

export function tileStyle(rect: Rect, gapPx = 5): Record<string, string> {
  const { x, y, w, h } = rect
  const EPS = 0.001
  const isLeftEdge = x <= EPS
  const isTopEdge = y <= EPS
  const isRightEdge = (x + w) >= 100 - EPS
  const isBottomEdge = (y + h) >= 100 - EPS

  const insetL = isLeftEdge ? 0 : gapPx / 2
  const insetR = isRightEdge ? 0 : gapPx / 2
  const insetT = isTopEdge ? 0 : gapPx / 2
  const insetB = isBottomEdge ? 0 : gapPx / 2

  const left = `calc(${x}% + ${insetL}px)`
  const top = `calc(${y}% + ${insetT}px)`
  const width = `calc(${w}% - ${(insetL + insetR)}px)`
  const height = `calc(${h}% - ${(insetT + insetB)}px)`

  return { left, top, width, height }
}