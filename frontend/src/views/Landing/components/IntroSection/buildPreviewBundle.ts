// File: src/views/Landing/components/IntroSection/buildPreviewBundle.ts

import type { RawListingBundle } from '@/domain/listings/types'

const PREVIEW_ID = 'listing-preview'

/**
 * Construit un RawListingBundle complet à partir du résultat partiel de
 * transformAirbnbToRawListingBundle, pour l’affichage dans l’embed preview.
 */
export function buildPreviewBundle(partial: Partial<RawListingBundle>): RawListingBundle {
  const core = partial.core ?? {}
  return {
    ...partial,
    core: {
      ...core,
      id: core.id ?? PREVIEW_ID,
    },
    bookings: partial.bookings ?? {
      price: 0,
      'booked-days': [],
      reservations: [],
      fees: [],
      pricing: {},
    },
    host: partial.host ?? null,
    notes: partial.notes ?? null,
    comments: partial.comments ?? null,
  }
}
