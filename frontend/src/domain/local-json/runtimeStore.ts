// File: src/domain/local-json/runtimeStore.ts

import type {
  DraftPatch,
  ListingResourceKey,
  RawArrival,
  RawBookings,
  RawComments,
  RawCore,
  RawHost,
  RawListingBundle,
  RawMedias,
  RawNotes,
  UserListingCard,
  VolatileBundle,
} from '@/domain/listings/types'
import { getCanonicalHost } from '@/domain/listings/host'
import {
  buildListingSlug,
  buildUniqueListingSlug,
  normalizeListingSlug,
} from '@/domain/listings/slug'

type RuntimeListingResources = {
  core: Partial<RawCore>
  medias: Partial<RawMedias>
  bookings: Partial<RawBookings>
  arrival: Partial<RawArrival>
  notes: Partial<RawNotes>
  comments: Partial<RawComments>
  host: Partial<RawHost>
}

const BUNDLED_RESOURCES = import.meta.glob<Record<string, unknown>>(
  '../../content/fr/ListingTest_[0-9]/{core,medias,bookings,arrival,notes,comments,host}.json',
  {
    eager: true,
    import: 'default',
  },
)

const RESOURCE_PATH_PATTERN = /(?:^|\/)(ListingTest_[^/]+)\/(core|medias|bookings|arrival|notes|comments|host)\.json$/

function deepClone<T>(value: T): T {
  if (value === null || value === undefined) return value
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value)
    } catch {
      // Fallback for non-cloneable values (Vue proxies, functions, symbols, cyclic refs).
    }
  }

  return cloneSerializable(value) as T
}

function cloneSerializable(value: unknown, seen = new WeakMap<object, unknown>()): unknown {
  if (value === null || value === undefined) return value

  const valueType = typeof value
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') return value
  if (valueType === 'bigint') return value.toString()
  if (valueType === 'function' || valueType === 'symbol') return undefined

  if (Array.isArray(value)) {
    return value.map((item) => {
      const cloned = cloneSerializable(item, seen)
      return cloned === undefined ? null : cloned
    })
  }

  if (valueType !== 'object') return undefined

  if (value instanceof Date) return value.toISOString()
  if (value instanceof RegExp) return value.toString()

  const objectValue = value as Record<string, unknown>
  if (seen.has(objectValue)) return seen.get(objectValue)

  const clonedObject: Record<string, unknown> = {}
  seen.set(objectValue, clonedObject)

  Object.entries(objectValue).forEach(([
    key,
    nested,
  ]) => {
    const clonedNested = cloneSerializable(nested, seen)
    if (clonedNested !== undefined) {
      clonedObject[key] = clonedNested
    }
  })

  return clonedObject
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function parseFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function fallbackArrival(): Partial<RawArrival> {
  return {
    intro: {
      title: 'Bienvenue',
      subtitle: "Pour profiter des lieux au maximum, voici votre guide d'arrivee.",
      tagline: 'Propulse par IndieHost',
    },
    practical: {
      savings: {
        message: 'Reservez en direct pour eviter les commissions.',
      },
      access: {
        address: "Adresse complete envoyee 24h avant l'arrivee.",
        checkIn: 'A partir de 16h.',
        checkOut: 'Avant 11h.',
        parking: 'Gratuit sur place.',
      },
      services: {
        wifi: 'Nom du reseau et mot de passe disponibles sur place.',
        contacts: 'Urgences 112.',
        assistance: "Assistance hote disponible par message.",
      },
      rules: '',
      shops: '',
    },
    guide: {
      title: '',
      content: '',
    },
  }
}

function fallbackResource(resource: ListingResourceKey, listingId: string): unknown {
  switch (resource) {
    case 'core':
      return {
        id: listingId,
        status: 'draft',
        title: 'Nouvelle annonce',
      } satisfies Partial<RawCore>
    case 'medias':
      return {
        images: [],
        videos: [],
      } satisfies Partial<RawMedias>
    case 'bookings':
      return {
        price: 0,
        fees: [],
        'booked-days': [],
        reservations: [],
      } satisfies Partial<RawBookings>
    case 'arrival':
      return fallbackArrival()
    case 'notes':
      return {} as Partial<RawNotes>
    case 'comments':
      return {
        comments: [],
      } satisfies Partial<RawComments>
    case 'host':
      return getCanonicalHost()
    default:
      return {}
  }
}

function deepMerge(target: any, patch: any): any {
  if (patch === null || patch === undefined) return patch
  if (Array.isArray(patch)) return deepClone(patch)
  if (typeof patch !== 'object') return patch

  const base = (target && typeof target === 'object' && !Array.isArray(target)) ? target : {}
  const next: Record<string, any> = { ...base }

  for (const [
    key,
    value,
  ] of Object.entries(patch)) {
    if (Array.isArray(value) || value === null || typeof value !== 'object') {
      next[key] = deepClone(value)
    } else {
      next[key] = deepMerge(base[key], value)
    }
  }

  return next
}

function createResourceBundle(listingId: string): RuntimeListingResources {
  return {
    core: deepClone(fallbackResource('core', listingId) as Partial<RawCore>),
    medias: deepClone(fallbackResource('medias', listingId) as Partial<RawMedias>),
    bookings: deepClone(fallbackResource('bookings', listingId) as Partial<RawBookings>),
    arrival: deepClone(fallbackResource('arrival', listingId) as Partial<RawArrival>),
    notes: deepClone(fallbackResource('notes', listingId) as Partial<RawNotes>),
    comments: deepClone(fallbackResource('comments', listingId) as Partial<RawComments>),
    host: deepClone(getCanonicalHost()),
  }
}

function buildInitialDatasets(): Map<string, RuntimeListingResources> {
  const byDirectory = new Map<string, Partial<Record<ListingResourceKey, unknown>>>()

  for (const [
    filePath,
    moduleValue,
  ] of Object.entries(BUNDLED_RESOURCES)) {
    const normalized = filePath.replace(/\\/g, '/')
    const match = normalized.match(RESOURCE_PATH_PATTERN)
    if (!match) continue

    const [
      ,
      directory,
      resource,
    ] = match
    const current = byDirectory.get(directory) ?? {}
    current[resource as ListingResourceKey] = moduleValue
    byDirectory.set(directory, current)
  }

  const listingMap = new Map<string, RuntimeListingResources>()
  const directories = Array.from(byDirectory.keys()).sort((a, b) => a.localeCompare(b))

  for (const directory of directories) {
    const resources = byDirectory.get(directory) ?? {}
    const fallback = createResourceBundle(directory)

    const core = asObject(resources.core) ?? (fallback.core as Record<string, unknown>)
    const rawListingId = core.id
    const listingId =
      typeof rawListingId === 'string' && rawListingId.trim()
        ? rawListingId.trim()
        : directory

    if (listingMap.has(listingId)) continue

    listingMap.set(listingId, {
      core: deepMerge(fallback.core, resources.core),
      medias: deepMerge(fallback.medias, resources.medias),
      bookings: deepMerge(fallback.bookings, resources.bookings),
      arrival: deepMerge(fallback.arrival, resources.arrival),
      notes: deepMerge(fallback.notes, resources.notes),
      comments: deepMerge(fallback.comments, resources.comments),
      host: deepClone(getCanonicalHost()),
    })
  }

  return listingMap
}

export type RuntimeLocalJsonStore = {
  listListings: () => UserListingCard[]
  resolveListingIdBySlug: (slug: string) => string | null
  getBundle: (listingId: string) => RawListingBundle
  getEditableBundle: (listingId: string) => RawListingBundle
  getVolatileBundle: (listingId: string) => VolatileBundle
  patchDraft: (listingId: string, patch: DraftPatch) => void
  publishDraft: (listingId: string, draft: RawListingBundle) => void
  createListing: (payload?: Partial<RawListingBundle>) => { listingId: string }
}

export function createRuntimeLocalJsonStore(): RuntimeLocalJsonStore {
  const listingsById = buildInitialDatasets()

  function buildListingIdCandidate(): string {
    const timestampPart = Date.now().toString(36)
    const randomPart = Math.random().toString(36).slice(2, 8) || '000000'
    return `listing-${timestampPart}-${randomPart}`
  }

  function buildUniqueListingId(): string {
    let listingId = buildListingIdCandidate()
    while (listingsById.has(listingId)) {
      listingId = buildListingIdCandidate()
    }
    return listingId
  }

  function isSlugTaken(targetSlug: string, exceptListingId?: string): boolean {
    for (const [
      listingId,
      record,
    ] of listingsById.entries()) {
      if (exceptListingId && listingId === exceptListingId) continue
      const core = asObject(record.core)
      const recordSlug = buildListingSlug({
        existingSlug: core?.slug,
        title: core?.title,
        listingId,
      })
      if (recordSlug === targetSlug) return true
    }

    return false
  }

  function resolveRecordSlug(listingId: string, record: RuntimeListingResources): string {
    const core = asObject(record.core)
    const baseSlug = buildListingSlug({
      existingSlug: core?.slug,
      title: core?.title,
      listingId,
    })
    const slug = buildUniqueListingSlug(baseSlug, (candidate) => isSlugTaken(candidate, listingId))
    record.core = {
      ...(record.core ?? {}),
      id: listingId,
      slug,
    }
    return slug
  }

  function sanitizeIncomingCorePatch(record: RuntimeListingResources, input: Partial<RawCore>): Partial<RawCore> {
    const sanitized: Partial<RawCore> = {
      ...input,
    }
    delete sanitized.id

    const existingSlug = normalizeListingSlug(asObject(record.core)?.slug)
    if (existingSlug) {
      delete sanitized.slug
    }

    return sanitized
  }

  const initialListingIds = Array.from(listingsById.keys()).sort((a, b) => a.localeCompare(b))
  for (const listingId of initialListingIds) {
    const record = listingsById.get(listingId)
    if (!record) continue
    resolveRecordSlug(listingId, record)
  }

  function ensureListing(listingIdRaw: string): { listingId: string; record: RuntimeListingResources } {
    const listingId = listingIdRaw.trim() || buildUniqueListingId()
    const existing = listingsById.get(listingId)
    if (existing) {
      existing.host = deepClone(getCanonicalHost())
      resolveRecordSlug(listingId, existing)
      return { listingId, record: existing }
    }

    const created = createResourceBundle(listingId)
    listingsById.set(listingId, created)
    resolveRecordSlug(listingId, created)
    return { listingId, record: created }
  }

  function toListingCard(listingId: string, record: RuntimeListingResources): UserListingCard {
    const core = asObject(record.core)
    const medias = asObject(record.medias)
    const bookings = asObject(record.bookings)
    const notes = asObject(record.notes)

    const images = Array.isArray(medias?.images)
      ? deepClone(medias.images as UserListingCard['images'])
      : undefined
    const firstImage = images?.[0]
    const noteValue = parseFiniteNumber(notes?.note)
    const nestedNote = asObject(notes?.note)
    const slug = resolveRecordSlug(listingId, record)

    return {
      listingId,
      slug,
      publicUrl: `/${slug}`,
      title: typeof core?.title === 'string' ? core.title : undefined,
      status: typeof core?.status === 'string' ? core.status : undefined,
      coverSrc: typeof firstImage?.src === 'string' ? firstImage.src : undefined,
      images,
      guestCapacity: parseFiniteNumber(core?.guest_capacity),
      pricePerNight: parseFiniteNumber(bookings?.price),
      rating: noteValue ?? parseFiniteNumber(nestedNote?.note),
    }
  }

  function listListings(): UserListingCard[] {
    return Array.from(listingsById.entries()).map(([
      listingId,
      record,
    ]) => toListingCard(listingId, record))
  }

  function resolveListingIdBySlug(slug: string): string | null {
    const normalizedSlug = normalizeListingSlug(slug)
    if (!normalizedSlug) return null

    for (const [
      listingId,
      record,
    ] of listingsById.entries()) {
      const core = asObject(record.core)
      const recordSlug = buildListingSlug({
        existingSlug: core?.slug,
        title: core?.title,
        listingId,
      })
      if (recordSlug === normalizedSlug) {
        resolveRecordSlug(listingId, record)
        return listingId
      }
    }

    return null
  }

  function getBundle(listingId: string): RawListingBundle {
    const { record } = ensureListing(listingId)
    return {
      core: deepClone(record.core),
      bookings: deepClone(record.bookings),
      medias: deepClone(record.medias),
      arrival: deepClone(record.arrival),
      notes: deepClone(record.notes),
      comments: deepClone(record.comments),
      host: deepClone(getCanonicalHost()),
    }
  }

  function getEditableBundle(listingId: string): RawListingBundle {
    const { record } = ensureListing(listingId)
    return {
      core: deepClone(record.core),
      bookings: deepClone(record.bookings),
      medias: deepClone(record.medias),
      arrival: deepClone(record.arrival),
    }
  }

  function getVolatileBundle(listingId: string): VolatileBundle {
    const { record } = ensureListing(listingId)
    return {
      bookings: deepClone(record.bookings),
      notes: deepClone(record.notes),
      comments: deepClone(record.comments),
      host: deepClone(getCanonicalHost()),
    }
  }

  function patchDraft(listingId: string, patch: DraftPatch) {
    const { record } = ensureListing(listingId)

    if (patch.core) {
      record.core = deepMerge(record.core, sanitizeIncomingCorePatch(record, patch.core))
    }
    if (patch.bookings) {
      record.bookings = deepMerge(record.bookings, patch.bookings)
    }
    if (patch.medias) {
      record.medias = deepMerge(record.medias, patch.medias)
    }
    if (patch.arrival) {
      record.arrival = deepMerge(record.arrival, patch.arrival)
    }
    if (patch.notes) {
      record.notes = deepMerge(record.notes, patch.notes)
    }
    if (patch.comments) {
      record.comments = deepMerge(record.comments, patch.comments)
    }
    resolveRecordSlug(listingId, record)
    record.host = deepClone(getCanonicalHost())
  }

  function publishDraft(listingId: string, draft: RawListingBundle) {
    const { record } = ensureListing(listingId)

    if (draft.core) {
      record.core = deepMerge(record.core, sanitizeIncomingCorePatch(record, draft.core))
    }
    if (draft.bookings) {
      record.bookings = deepMerge(record.bookings, draft.bookings)
    }
    if (draft.medias) {
      record.medias = deepMerge(record.medias, draft.medias)
    }
    if (draft.arrival) {
      record.arrival = deepMerge(record.arrival, draft.arrival)
    }
    if (draft.notes) {
      record.notes = deepMerge(record.notes, draft.notes)
    }
    if (draft.comments) {
      record.comments = deepMerge(record.comments, draft.comments)
    }
    resolveRecordSlug(listingId, record)
    record.host = deepClone(getCanonicalHost())
  }

  function createListing(payload?: Partial<RawListingBundle>): { listingId: string } {
    const listingId = buildUniqueListingId()
    const created = createResourceBundle(listingId)
    listingsById.set(listingId, created)

    if (payload) {
      publishDraft(listingId, payload as RawListingBundle)
    } else {
      resolveRecordSlug(listingId, created)
    }

    return { listingId }
  }

  return {
    listListings,
    resolveListingIdBySlug,
    getBundle,
    getEditableBundle,
    getVolatileBundle,
    patchDraft,
    publishDraft,
    createListing,
  }
}
