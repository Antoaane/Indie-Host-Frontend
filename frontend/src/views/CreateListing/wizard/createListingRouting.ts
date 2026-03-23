// File: src/views/CreateListing/wizard/createListingRouting.ts

import type { RouteLocationRaw } from 'vue-router'

type BuildEditorRouteParams = {
  listingId?: string
}

export function buildEditorRoute({ listingId }: BuildEditorRouteParams): RouteLocationRaw {
  const query = listingId ? { listingId } : undefined

  return {
    name: 'editor',
    query,
  }
}
