export function createListingPublicId(): string {
  return `listing-${Date.now()}`
}

export function createReservationPublicId(listingId: string, start: string, end: string): string {
  return `reservation-${listingId}-${start}-${end}-${Math.random().toString(36).slice(2, 8)}`
}

export function createConversationPublicId(listingId: string, reservationId?: string): string {
  return reservationId ? `${listingId}::${reservationId}` : `${listingId}::conversation-${Date.now()}`
}

export function createMessagePublicId(conversationId: string): string {
  return `message-${conversationId}-${Math.random().toString(36).slice(2, 10)}`
}
