// File: src/views/Editor/utils/editorSourceUser.ts

import type { EditorSource } from '@/views/Editor/types/editor'
import {
  fetchEditableListingBundle,
  fetchUserListings,
  fetchVolatileListingBundle,
  publishListingDraft,
} from '@/views/Editor/utils/listingApi'

export function createUserEditorSource(userId: string): EditorSource {
  return {
    fetchListings: () => fetchUserListings(userId),
    fetchEditableListingBundle,
    fetchVolatileListingBundle,
    publishListingDraft,
  }
}

