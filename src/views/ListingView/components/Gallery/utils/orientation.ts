// File: src/views/ListingView/components/Gallery/utils/orientation.ts

import type { Rect, Ori, Item } from '@/views/ListingView/components/Gallery/utils/types'


export function classifyAspect(ar: number): Ori {
  if (ar > 1.15) return 'H'
  if (ar < 0.87) return 'V'
  return 'S'
}


export function rectToOri(r: Rect): Ori {
  return classifyAspect(r.w / r.h)
}


// Précharge les orientations natives des images (remplit et met à jour un tableau)
export function preloadOrientations(items: Item[], onUpdate: (idx: number, ori: Ori) => void, initial: Ori = 'H'): Ori[] {
  const arr: Ori[] = new Array(items.length).fill(initial)
  items.forEach((it, idx) => {
    const im = new Image()
    im.onload = () => {
      const ar = (im.naturalWidth || 1) / (im.naturalHeight || 1)
      const ori = classifyAspect(ar)
      arr[idx] = ori
      onUpdate(idx, ori)
    }
    im.onerror = () => { arr[idx] = 'H'; onUpdate(idx, 'H') }
    im.src = it.image
  })
  return arr
}