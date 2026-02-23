// File: src/views/Editor/composables/editorDraftTools.ts

import { normalizeListingStatus } from '@/domain/listings/status'
import type { RawListingBundle } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'

export function mergeDeepObject(target: any, source: any): any {
  if (source === null || source === undefined) return source
  if (Array.isArray(source)) return source
  if (typeof source !== 'object') return source

  const baseValue = target && typeof target === 'object' && !Array.isArray(target) ? target : {}
  const merged: Record<string, any> = { ...baseValue }

  Object.entries(source as Record<string, any>).forEach(([
    key,
    value,
  ]) => {
    if (Array.isArray(value) || value === null || typeof value !== 'object') {
      merged[key] = value
    } else {
      merged[key] = mergeDeepObject(baseValue[key], value)
    }
  })

  return merged
}

export function mergeDraftPatch(base: DraftPatch | null, patch: DraftPatch): DraftPatch {
  const next: DraftPatch = { ...(base ?? {}) }

  if (patch.core) {
    next.core = { ...(next.core ?? {}), ...patch.core }
  }

  if (patch.bookings) {
    next.bookings = { ...(next.bookings ?? {}), ...patch.bookings }
  }

  if (patch.medias) {
    next.medias = { ...(next.medias ?? {}), ...patch.medias }
  }

  if (patch.arrival) {
    next.arrival = mergeDeepObject(next.arrival, patch.arrival)
  }

  return next
}

export function snapshotListingDraft(bundle: RawListingBundle): RawListingBundle {
  return JSON.parse(
    JSON.stringify({
      core: bundle.core ?? null,
      bookings: bundle.bookings ?? null,
      medias: bundle.medias ?? null,
      arrival: bundle.arrival ?? null,
      notes: bundle.notes ?? null,
      comments: bundle.comments ?? null,
      host: bundle.host ?? null,
    }),
  ) as RawListingBundle
}

export function snapshotListingStatus(status?: string): RawListingBundle {
  const normalized = normalizeListingStatus(status)
  if (!normalized) return snapshotListingDraft({})
  return snapshotListingDraft({ core: { status: normalized } })
}

export function areListingDraftsEqual(left?: RawListingBundle | null, right?: RawListingBundle | null): boolean {
  return JSON.stringify(snapshotListingDraft(left ?? {})) === JSON.stringify(snapshotListingDraft(right ?? {}))
}

export function applyPatchToDraftBundle(currentDraft: RawListingBundle | null, patch: DraftPatch): RawListingBundle {
  const nextDraft: RawListingBundle = currentDraft ? { ...currentDraft } : {}

  if (patch.core) {
    nextDraft.core = {
      ...(nextDraft.core ?? {}),
      ...patch.core,
    }
  }

  if (patch.bookings) {
    nextDraft.bookings = {
      ...(nextDraft.bookings ?? {}),
      ...patch.bookings,
    }
  }

  if (patch.medias) {
    nextDraft.medias = {
      ...(nextDraft.medias ?? {}),
      ...patch.medias,
    }
  }

  if (patch.arrival) {
    nextDraft.arrival = mergeDeepObject(nextDraft.arrival, patch.arrival)
  }

  return nextDraft
}
