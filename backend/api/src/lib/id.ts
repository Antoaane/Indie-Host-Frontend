export function buildListingId(base?: string | null): string {
  const trimmed = (base ?? '').trim();
  if (trimmed) return trimmed;
  return `listing-${Date.now()}`;
}

export function buildReservationId(listingId: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `reservation-${listingId}-${random}`;
}

export function buildMessageId(conversationId: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `message-${conversationId}-${random}`;
}
