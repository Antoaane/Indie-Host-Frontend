// File: src/views/CreateListing/wizard/createListingRouting.ts

import type { RouteLocationRaw } from 'vue-router'

type BuildEditorRouteParams = {
  userId?: string | null
  listingId?: string
}

export function buildEditorRoute({ userId, listingId }: BuildEditorRouteParams): RouteLocationRaw {
  const query = listingId ? { listingId } : undefined
  const normalizedUserId = typeof userId === 'string' ? userId.trim() : ''

  if (normalizedUserId) {
    return {
      name: 'editor-user',
      params: { userId: normalizedUserId },
      query,
    }
  }

  return {
    name: 'editor',
    query,
  }
}
