// File: src/domain/listings/cards.ts

import type { UserListingCard } from '@/domain/listings/types'
import { orderByIndex } from '@/utils/medias/order'

export function normalizeListingCardMedia(listing: UserListingCard): UserListingCard {
  const rawImages = Array.isArray(listing.images) ? listing.images : []
  const validImages = rawImages
    .filter((image) => typeof image?.src === 'string' && image.src.trim().length > 0)
    .map((image) => ({ ...image, src: image.src.trim() }))
  const orderedImages = orderByIndex(validImages)

  const coverFromField = typeof listing.coverSrc === 'string' ? listing.coverSrc.trim() : ''
  const coverSrc = coverFromField || orderedImages[0]?.src || undefined

  return {
    ...listing,
    coverSrc,
    images: orderedImages,
  }
}

export function normalizeListingCardsMedia(listings: UserListingCard[]): UserListingCard[] {
  return listings.map((listing) => normalizeListingCardMedia(listing))
}
