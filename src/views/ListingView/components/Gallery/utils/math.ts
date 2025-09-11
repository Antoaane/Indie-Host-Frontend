// File: src/views/ListingView/components/Gallery/utils/math.ts

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
export const rand = (min: number, max: number) => Math.random() * (max - min) + min
export const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1))
export const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]

/**
 * Génère une valeur aléatoire autour d'une valeur précédente, bornée :
 * - prev: valeur précédente
 * - min/max: bornes absolues
 * - maxDelta: écart maximum autorisé par rapport à prev
 * - minDelta: (optionnel) écart minimum souhaité par rapport à prev
 */
export function boundedRandAround(
  prev: number,
  min: number,
  max: number,
  maxDelta: number,
  minDelta = 0
): number {
  const low = Math.max(min, prev - maxDelta)
  const high = Math.min(max, prev + maxDelta)

  let candidate: number
  let tries = 0
  do {
    candidate = clamp(rand(min, max), low, high)
    tries++
  } while (Math.abs(candidate - prev) < minDelta && tries < 10)

  const jitter = rand(-1.5, 1.5)
  return clamp(candidate + jitter, min, max)
}