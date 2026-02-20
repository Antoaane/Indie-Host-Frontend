// File: src/views/CreateListing/wizard/createListing.types.ts

import type { Component } from 'vue'

import type { RawListingBundle } from '@/domain/listings/types'

export type CreateListingStep = {
  id: string
  label: string
  description: string
  component: Component
  props: (draft: RawListingBundle) => Record<string, unknown>
  acceptsPatch?: boolean
  validate?: (draft: RawListingBundle) => string | null
}

export type CreateListingStepItem = {
  id: string
  label: string
  index: number
  isActive: boolean
  isDone: boolean
  isDisabled: boolean
}

export type PersistedCreateDraft = {
  stepIndex: number
  draft: RawListingBundle
  updatedAt: string
}
