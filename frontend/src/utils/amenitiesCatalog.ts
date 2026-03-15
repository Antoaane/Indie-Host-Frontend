// File: src/utils/amenitiesCatalog.ts

import { mockAmenitiesCatalog, type AmenityCatalogItem } from '@/views/Editor/mocks/amenitiesCatalog'

function normalizeAmenityId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

const amenitiesCatalogById = new Map<string, AmenityCatalogItem>()

for (const item of mockAmenitiesCatalog.amenities ?? []) {
  const id = normalizeAmenityId(item.id)
  if (!id) continue
  amenitiesCatalogById.set(id, item)
}

export function isKnownAmenityId(value: unknown): value is string {
  const id = normalizeAmenityId(value)
  return Boolean(id && amenitiesCatalogById.has(id))
}

export function getKnownAmenityCatalogItem(value: unknown): AmenityCatalogItem | null {
  const id = normalizeAmenityId(value)
  if (!id) return null
  return amenitiesCatalogById.get(id) ?? null
}

