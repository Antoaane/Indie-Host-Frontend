// File: src/views/Editor/utils/editorSourceStatic.ts

import core0 from '@/content/fr/ListingTest_0/core.json'
import medias0 from '@/content/fr/ListingTest_0/medias.json'
import bookings0 from '@/content/fr/ListingTest_0/bookings.json'
import notes0 from '@/content/fr/ListingTest_0/notes.json'
import comments0 from '@/content/fr/ListingTest_0/comments.json'
import host0 from '@/content/fr/ListingTest_0/host.json'

import core1 from '@/content/fr/ListingTest_1/core.json'
import medias1 from '@/content/fr/ListingTest_1/medias.json'
import bookings1 from '@/content/fr/ListingTest_1/bookings.json'
import notes1 from '@/content/fr/ListingTest_1/notes.json'
import comments1 from '@/content/fr/ListingTest_1/comments.json'
import host1 from '@/content/fr/ListingTest_1/host.json'

import core2 from '@/content/fr/ListingTest_2/core.json'
import medias2 from '@/content/fr/ListingTest_2/medias.json'
import bookings2 from '@/content/fr/ListingTest_2/bookings.json'
import notes2 from '@/content/fr/ListingTest_2/notes.json'
import comments2 from '@/content/fr/ListingTest_2/comments.json'
import host2 from '@/content/fr/ListingTest_2/host.json'

import core3 from '@/content/fr/ListingTest_3/core.json'
import medias3 from '@/content/fr/ListingTest_3/medias.json'
import bookings3 from '@/content/fr/ListingTest_3/bookings.json'
import notes3 from '@/content/fr/ListingTest_3/notes.json'
import comments3 from '@/content/fr/ListingTest_3/comments.json'
import host3 from '@/content/fr/ListingTest_3/host.json'

import type { EditorSource } from '@/views/Editor/types/editor'
import type { RawListingBundle } from '@/views/ListingView/utils/useParseContent'
import type { UserListingCard, VolatileBundle } from '@/views/Editor/utils/listingApi'

type StaticListingDataset = {
  core: typeof core0
  medias: typeof medias0
  bookings: typeof bookings0
  notes: typeof notes0
  comments: typeof comments0
  host: typeof host0
}

const STATIC_LISTINGS: StaticListingDataset[] = [
  { core: core0, medias: medias0, bookings: bookings0, notes: notes0, comments: comments0, host: host0 },
  { core: core1, medias: medias1, bookings: bookings1, notes: notes1, comments: comments1, host: host1 },
  { core: core2, medias: medias2, bookings: bookings2, notes: notes2, comments: comments2, host: host2 },
  { core: core3, medias: medias3, bookings: bookings3, notes: notes3, comments: comments3, host: host3 },
]

const STATIC_LISTING_BY_ID = new Map<string, StaticListingDataset>(
  STATIC_LISTINGS.map((dataset) => [dataset.core.id, dataset]),
)

function buildStaticCard(dataset: StaticListingDataset): UserListingCard {
  const coverSrc = dataset.medias.images?.[0]?.src

  return {
    listingId: dataset.core.id,
    title: dataset.core.title,
    status: dataset.core.status,
    coverSrc,
    guestCapacity: dataset.core.guest_capacity,
    pricePerNight: dataset.bookings.price,
    rating: dataset.notes.note?.note,
  }
}

export function createStaticEditorSource(): EditorSource {
  return {
    fetchListings: async () => STATIC_LISTINGS.map(buildStaticCard),
    fetchEditableListingBundle: async (listingId: string) => {
      const dataset = STATIC_LISTING_BY_ID.get(listingId)

      if (!dataset) {
        return {
          core: { id: listingId },
          medias: { images: [], videos: [] },
        }
      }

      return {
        core: dataset.core as any,
        medias: dataset.medias as any,
      }
    },
    fetchVolatileListingBundle: async (listingId: string): Promise<VolatileBundle> => {
      const dataset = STATIC_LISTING_BY_ID.get(listingId)
      if (!dataset) return { bookings: null, notes: null, comments: null, host: null }

      return {
        bookings: dataset.bookings as any,
        notes: dataset.notes as any,
        comments: dataset.comments as any,
        host: dataset.host as any,
      }
    },
    publishListingDraft: async (listingId: string, draft: RawListingBundle) => {
      if (import.meta.env.DEV) {
        console.log('[Editor][static] publishListingDraft noop', { listingId, draft })
      }
    },
  }
}
