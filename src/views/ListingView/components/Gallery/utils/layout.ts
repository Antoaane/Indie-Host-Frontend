// File: src/views/ListingView/components/Gallery/utils/layout.ts

import type { Rect } from '@/views/ListingView/components/Gallery/utils/types'
import { clamp, rand } from '@/views/ListingView/components/Gallery/utils/math'

function splitRect(rect: Rect, orientation: 'h' | 'v', ratio: number): [Rect, Rect] {
  ratio = clamp(ratio, 0.28, 0.72)
  if (orientation === 'v') {
    const w1 = rect.w * ratio
    const w2 = rect.w - w1
    return [
      { x: rect.x, y: rect.y, w: w1, h: rect.h },
      { x: rect.x + w1, y: rect.y, w: w2, h: rect.h }
    ]
  } else {
    const h1 = rect.h * ratio
    const h2 = rect.h - h1
    return [
      { x: rect.x, y: rect.y, w: rect.w, h: h1 },
      { x: rect.x, y: rect.y + h1, w: rect.w, h: h2 }
    ]
  }
}

export function generateLayout(targetCount: number, minTileW: number, minTileH: number): Rect[] {
  const rects: Rect[] = [{ x: 0, y: 0, w: 100, h: 100 }]
  let guard = 0
  while (rects.length < targetCount && guard++ < 200) {
    let idx = 0
    let bestArea = -1
    for (let i = 0; i < rects.length; i++) {
      const a = rects[i].w * rects[i].h
      if (a > bestArea) { bestArea = a; idx = i }
    }
    const r = rects.splice(idx, 1)[0]

    const canV = r.w >= 2 * minTileW
    const canH = r.h >= 2 * minTileH

    if (!canV && !canH) {
      rects.push(r)
      const anySplittable = rects.some(R => R.w >= 2 * minTileW || R.h >= 2 * minTileH)
      if (!anySplittable) break
      continue
    }

    let orientation: 'h' | 'v'
    if (r.w > r.h) orientation = canV ? 'v' : 'h'
    else orientation = canH ? 'h' : 'v'

    let minR: number, maxR: number
    if (orientation === 'v') {
      const bound = minTileW / r.w
      minR = Math.max(0.28, bound)
      maxR = Math.min(0.72, 1 - bound)
      if (minR >= maxR) {
        if (canH) { orientation = 'h' } else { rects.push(r); continue }
      }
    }
    if (orientation === 'h') {
      const bound = minTileH / r.h
      minR = Math.max(0.28, bound)
      maxR = Math.min(0.72, 1 - bound)
      if (minR >= maxR) {
        if (canV) { orientation = 'v' } else { rects.push(r); continue }
      }
    }

    const ratio = rand(minR!, maxR!)
    const [a, b] = splitRect(r, orientation, ratio)
    rects.push(a, b)
  }
  return rects
}

