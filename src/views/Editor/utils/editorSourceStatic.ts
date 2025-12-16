// File: src/views/Editor/utils/editorSourceStatic.ts

import coreJSON from '@/content/fr/ListingTest/core.json'
import mediasJSON from '@/content/fr/ListingTest/medias.json'
import bookingsJSON from '@/content/fr/ListingTest/bookings.json'
import notesJSON from '@/content/fr/ListingTest/notes.json'
import commentsJSON from '@/content/fr/ListingTest/comments.json'
import hostJSON from '@/content/fr/ListingTest/host.json'

import type { EditorSource } from '@/views/Editor/types/editor'
import type { RawListingBundle } from '@/views/ListingView/utils/useParseContent'
import type { UserListingCard, VolatileBundle } from '@/views/Editor/utils/listingApi'

const baseNumericId = Number(coreJSON.id)
const STATIC_LISTING_IDS = Number.isFinite(baseNumericId)
  ? [
      coreJSON.id,
      `${baseNumericId + 1}`,
      `${baseNumericId + 2}`,
      `${baseNumericId + 3}`,
    ]
  : [
      coreJSON.id,
      `${coreJSON.id}-2`,
      `${coreJSON.id}-3`,
      `${coreJSON.id}-4`,
    ]

function buildStaticCard(listingId: string, idx: number): UserListingCard {
  const coverSrc = mediasJSON.images?.[idx % Math.max(1, mediasJSON.images.length)]?.src

  return {
    listingId,
    title: idx === 0 ? coreJSON.title : `${coreJSON.title} (${idx + 1})`,
    status: idx % 2 === 0 ? 'published' : 'draft',
    coverSrc,
    guestCapacity: coreJSON.guest_capacity,
    pricePerNight: bookingsJSON.price,
    rating: notesJSON.note?.note,
  }
}

function buildStaticEditableBundle(listingId: string, idx: number): RawListingBundle {
  return {
    core: {
      ...(coreJSON as any),
      id: listingId,
      title: idx === 0 ? coreJSON.title : `${coreJSON.title} (${idx + 1})`,
    },
    medias: mediasJSON as any,
  }
}

function buildStaticVolatileBundle(): VolatileBundle {
  return {
    bookings: bookingsJSON as any,
    notes: notesJSON as any,
    comments: commentsJSON as any,
    host: hostJSON as any,
  }
}

export function createStaticEditorSource(): EditorSource {
  return {
    fetchListings: async () => STATIC_LISTING_IDS.map(buildStaticCard),
    fetchEditableListingBundle: async (listingId: string) => {
      const idx = Math.max(0, STATIC_LISTING_IDS.indexOf(listingId))
      return buildStaticEditableBundle(listingId, idx)
    },
    fetchVolatileListingBundle: async (_listingId: string): Promise<VolatileBundle> => buildStaticVolatileBundle(),
    publishListingDraft: async (listingId: string, draft: RawListingBundle) => {
      if (import.meta.env.DEV) {
        console.log('[Editor][static] publishListingDraft noop', { listingId, draft })
      }
    },
  }
}
