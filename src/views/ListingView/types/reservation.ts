// File: src/views/ListingView/types/reservation.ts

import type { FeeItem } from '@/views/ListingView/types/listing'

export type OccupantCounts = Record<'adults' | 'children' | 'babies' | 'animals' | 'pmr', number>

export type ReservationPayload = {
  startISO: string | null
  endISO: string | null
  nights: number
  occupants: OccupantCounts
  fees: FeeItem[]
  total: number
}
