// File: src/views/ListingView/types/reservation.ts

import type { FeeItem } from '@/views/ListingView/types/listing'
import type { OccupantCounts as ListingOccupantCounts } from '@/domain/listings/reservationRules'

export type OccupantCounts = ListingOccupantCounts

export type ReservationPayload = {
  startISO: string | null
  endISO: string | null
  nights: number
  occupants: OccupantCounts
  fees: FeeItem[]
  total: number
  pricing?: {
    nightlySubtotal: number
    nightlyDiscountTotal: number
    nightlyDiscountPercent: number
    discountThresholdNights: number | null
    nightlyTotal: number
    averageNightlyPrice: number
    feesTotal: number
    extraGuestsTotal: number
  }
}
