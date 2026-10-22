// File: src/views/ListingView/components/Gallery/utils/style.ts

import type { Rect } from '@/views/ListingView/components/Gallery/utils/types'

/** Rect minuscule pour masquer une tuile sans générer d'erreur de style */
export const TINY_RECT: Rect = { x: 50, y: 50, w: 0.0001, h: 0.0001 }

/**
 * Calcule le style d'une tuile :
 * - remplit exactement l'espace (left/top/width/height) avec gap interne
 * - ajoute une animation douce de disparition via scale + opacity selon la taille
 * - désactive les events quand quasi invisible
 * - blindé contre rect indéfini
 */
export function tileStyle(rect?: Rect, gapPx = 5): Record<string, string> {
  // Garde-fou si rect est absent pendant un tick de rendu
  if (!rect) {
    return {
      left: '50%',
      top: '50%',
      width: '0px',
      height: '0px',
      transform: 'translateZ(0) scale(0.9)',
      opacity: '0',
      pointerEvents: 'none',
      zIndex: '0',
    }
  }

  const { x, y, w, h } = rect
  const EPS = 0.001

  const isLeftEdge = x <= EPS
  const isTopEdge = y <= EPS
  const isRightEdge = x + w >= 100 - EPS
  const isBottomEdge = y + h >= 100 - EPS

  const insetL = isLeftEdge ? 0 : gapPx / 2
  const insetR = isRightEdge ? 0 : gapPx / 2
  const insetT = isTopEdge ? 0 : gapPx / 2
  const insetB = isBottomEdge ? 0 : gapPx / 2

  const left = `calc(${x}% + ${insetL}px)`
  const top = `calc(${y}% + ${insetT}px)`
  const width = `calc(${w}% - ${(insetL + insetR)}px)`
  const height = `calc(${h}% - ${(insetT + insetB)}px)`

  // Échelle/opacité selon la plus petite dimension :
  //  - minSide >= 20% -> scale=1, opacity=1
  //  - minSide -> 0   -> scale -> 0.9, opacity -> 0 (jamais depuis scale(0) :
  //    le rect se réduit déjà, l'échelle ne fait qu'accompagner)
  const minSide = Math.max(0, Math.min(w, h))
  const visibility = Math.max(0, Math.min(1, minSide / 20))
  const scale = 0.9 + visibility * 0.1
  const opacity = visibility

  const transform = `translateZ(0) scale(${scale})`
  const pointerEvents = visibility < 0.1 ? 'none' : 'auto'
  const zIndex = String(10 + Math.round(visibility * 90))

  return { left, top, width, height, transform, opacity: String(opacity), pointerEvents, zIndex }
}
