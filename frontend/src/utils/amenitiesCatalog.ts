// File: src/utils/amenitiesCatalog.ts

import type { RawAmenity } from '@/domain/listings/types'
import { mockAmenitiesCatalog, type AmenityCatalogItem } from '@/views/Editor/mocks/amenitiesCatalog'
import { normalizeSearchText } from '@/utils/search'

export type KnownRawAmenity = RawAmenity & {
  id: string
}

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

function resolveKnownAmenityIdFromName(value: unknown): string | null {
  const normalizedName = normalizeSearchText(value)
  if (!normalizedName) return null

  for (const item of mockAmenitiesCatalog.amenities ?? []) {
    if (normalizeSearchText(item.name) === normalizedName) {
      return normalizeAmenityId(item.id)
    }
  }

  return null
}

function resolveKnownAmenityId(value: Partial<RawAmenity> | null | undefined): string | null {
  if (!value) return null

  const amenityId = normalizeAmenityId((value as Record<string, unknown>).id)
  if (isKnownAmenityId(amenityId)) return amenityId

  const iconId = normalizeAmenityId((value as Record<string, unknown>).icon)
  if (isKnownAmenityId(iconId)) return iconId

  return resolveKnownAmenityIdFromName((value as Record<string, unknown>).name)
}

export function sanitizeKnownAmenities(
  input: Array<Partial<RawAmenity> | null | undefined> | null | undefined,
): KnownRawAmenity[] {
  const output: KnownRawAmenity[] = []
  const seenIds = new Set<string>()

  for (const amenity of input ?? []) {
    const amenityId = resolveKnownAmenityId(amenity)
    if (!amenityId || seenIds.has(amenityId)) continue

    const catalogItem = getKnownAmenityCatalogItem(amenityId)
    seenIds.add(amenityId)

    output.push({
      id: amenityId,
      name: typeof amenity?.name === 'string' && amenity.name.trim()
        ? amenity.name.trim()
        : catalogItem?.name ?? amenityId,
      ...(typeof amenity?.description === 'string' && amenity.description.trim()
        ? { description: amenity.description.trim() }
        : catalogItem?.description
        ? { description: catalogItem.description }
        : {}),
      category: typeof amenity?.category === 'string' && amenity.category.trim()
        ? amenity.category.trim()
        : catalogItem?.category ?? 'Autres',
      relevance: Number.isFinite(Number(amenity?.relevance))
        ? Number(amenity?.relevance)
        : Number(catalogItem?.relevance ?? 0),
      pinned: Boolean(amenity?.pinned),
      ...(typeof amenity?.perkEligible === 'boolean' ? { perkEligible: amenity.perkEligible } : {}),
      ...(Number.isFinite(Number(amenity?.perkScore)) ? { perkScore: Number(amenity?.perkScore) } : {}),
      ...(Number.isFinite(Number(amenity?.perkPriority)) ? { perkPriority: Number(amenity?.perkPriority) } : {}),
    })
  }

  return output
}
