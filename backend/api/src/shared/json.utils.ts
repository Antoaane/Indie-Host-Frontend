export type JsonObject = Record<string, unknown>

export function isPlainObject(value: unknown): value is JsonObject {
  if (!value || typeof value !== 'object') return false
  return Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null
}

export function asObject(value: unknown): JsonObject {
  return isPlainObject(value) ? value : {}
}

export function deepMerge<T>(target: T, patch: unknown): T {
  if (!isPlainObject(target) || !isPlainObject(patch)) {
    return (patch ?? target) as T
  }

  const next: JsonObject = { ...target }

  for (const [key, value] of Object.entries(patch)) {
    const previous = next[key]
    if (isPlainObject(previous) && isPlainObject(value)) {
      next[key] = deepMerge(previous, value)
      continue
    }
    next[key] = value
  }

  return next as T
}

export function toStringOrEmpty(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

export function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

export function toNonNegativeInt(value: unknown, fallback = 0): number {
  return Math.max(0, Math.trunc(toFiniteNumber(value, fallback)))
}
