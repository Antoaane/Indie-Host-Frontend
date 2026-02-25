// File: src/views/CreateListing/wizard/createListingRouting.ts

import type { RouteLocationRaw } from 'vue-router'

import type { EditorMode } from '@/views/Editor/types/editor'
import { cleanText } from '@/views/CreateListing/wizard/createListingDraft'

type BuildEditorRouteParams = {
  mode: EditorMode
  userId?: string | null
  listingId?: string
}

export function buildEditorRoute({ mode, userId, listingId }: BuildEditorRouteParams): RouteLocationRaw {
  const query = listingId ? { listingId } : undefined
  const routeName = mode === 'user' ? 'editor-user' : 'editor'
  const normalizedUserId = cleanText(userId)

  if (mode === 'user' && normalizedUserId) {
    return {
      name: routeName,
      params: { userId: normalizedUserId },
      query,
    }
  }

  return {
    name: routeName,
    query,
  }
}
