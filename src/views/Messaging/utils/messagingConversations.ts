// File: src/views/Messaging/utils/messagingConversations.ts

import { toUtcDay } from '@/domain/listings/bookings'
import { getListingStatusFlags } from '@/domain/listings/status'
import type { RawBookingReservation, RawHost, RawReservationMessage, RawReservationMessageState, UserListingCard } from '@/domain/listings/types'
import type { ConversationStatus, MessagingConversation, MessagingMessage, MessagingParticipant } from '@/views/Messaging/types/messaging'

const TONE_PALETTE = [
  'lagoon',
  'ocean',
  'forest',
  'dune',
  'iris',
  'sunset',
] as const

function toIsoDateTime(value?: string | null): string | null {
  if (!value || typeof value !== 'string') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function toIsoDateMidday(value?: string | null): string | null {
  if (!value || typeof value !== 'string') return null
  const utc = toUtcDay(value)
  if (utc === null) return null
  return new Date(utc + 12 * 60 * 60 * 1000).toISOString()
}

function toMs(value?: string | null): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toUtcTodayMs(referenceDate = new Date()) {
  return Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate())
}

function normalizeLabel(label: string) {
  return label.replace(/\./g, '').trim()
}

function formatConversationTime(isoDateTime?: string | null, referenceDate = new Date()) {
  if (!isoDateTime) return ''
  const date = new Date(isoDateTime)
  if (Number.isNaN(date.getTime())) return ''

  const sameDay = date.toDateString() === referenceDate.toDateString()
  if (sameDay) {
    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  const yesterday = new Date(referenceDate)
  yesterday.setDate(referenceDate.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Hier'
  }

  const sevenDaysAgo = new Date(referenceDate)
  sevenDaysAgo.setDate(referenceDate.getDate() - 6)
  if (date >= sevenDaysAgo) {
    return normalizeLabel(
      new Intl.DateTimeFormat('fr-FR', {
        weekday: 'short',
      }).format(date),
    )
  }

  return normalizeLabel(
    new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
    }).format(date),
  )
}

function formatReservationDate(isoDate?: string) {
  const utc = toUtcDay(isoDate)
  if (utc === null) return ''

  return normalizeLabel(
    new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(utc)),
  )
}

function formatAmount(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(value)))
}

function truncatePreview(value: string, limit = 120) {
  if (value.length <= limit) return value
  return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`
}

function resolveTone(seed: string) {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0
  }
  const paletteIndex = Math.abs(hash) % TONE_PALETTE.length
  return TONE_PALETTE[paletteIndex] ?? TONE_PALETTE[0]
}

function initials(name: string) {
  const clean = (name ?? '').trim()
  if (!clean) return 'IH'
  const parts = clean.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function sumGuests(reservation: RawBookingReservation) {
  const guests = reservation.guests
  const pmr = Number(guests?.pmr ?? 0) || 0
  return (Number(guests?.adults ?? 0) || 0) + (Number(guests?.children ?? 0) || 0) + (Number(guests?.infants ?? 0) || 0) + (Number(guests?.pets ?? 0) || 0) + pmr
}

function deriveReservationCode(reservationId: string) {
  const digits = reservationId.replace(/\D+/g, '')
  if (digits.length >= 4) return `IH-${digits.slice(-4)}`
  const compact = reservationId
    .replace(/[^a-z0-9]/gi, '')
    .slice(-6)
    .toUpperCase()
  return compact ? `IH-${compact}` : 'IH-0000'
}

function deriveConversationStatus(
  listing: UserListingCard,
  reservation: RawBookingReservation,
  referenceDate = new Date(),
): {
  conversationStatus: ConversationStatus
  reservationStatusLabel: string
} {
  const listingStatus = getListingStatusFlags(listing.status)
  const todayMs = toUtcTodayMs(referenceDate)
  const startMs = toUtcDay(reservation.start) ?? 0
  const endMs = toUtcDay(reservation.end) ?? 0
  const paymentStatus = reservation.payment?.status

  if (listingStatus.isDeleted) {
    return {
      conversationStatus: 'archived',
      reservationStatusLabel: 'Annonce supprimée',
    }
  }

  if (listingStatus.isBlocked || listingStatus.isArchived) {
    return {
      conversationStatus: 'archived',
      reservationStatusLabel: 'Annonce indisponible',
    }
  }

  if (endMs > 0 && endMs < todayMs) {
    return {
      conversationStatus: 'archived',
      reservationStatusLabel: 'Séjour terminé',
    }
  }

  if (listingStatus.isPaused) {
    return {
      conversationStatus: 'pending',
      reservationStatusLabel: 'Annonce en pause',
    }
  }

  if (paymentStatus === 'pending') {
    return {
      conversationStatus: 'pending',
      reservationStatusLabel: 'Paiement en attente',
    }
  }

  if (startMs <= todayMs && todayMs <= endMs) {
    return {
      conversationStatus: 'active',
      reservationStatusLabel: 'En séjour',
    }
  }

  if (startMs > todayMs) {
    return {
      conversationStatus: 'active',
      reservationStatusLabel: 'Séjour à venir',
    }
  }

  return {
    conversationStatus: 'active',
    reservationStatusLabel: 'Réservation confirmée',
  }
}

function buildHostParticipant(listingId: string, host: Partial<RawHost> | null | undefined): MessagingParticipant {
  const name = typeof host?.name === 'string' && host.name.trim() ? host.name.trim() : 'Hôte'
  return {
    id: `host-${listingId}`,
    name,
    initials: initials(name),
    tone: resolveTone(`host-${listingId}`),
  }
}

function buildGuestParticipant(reservation: RawBookingReservation): MessagingParticipant {
  const guestName = reservation.guestName?.trim() || 'Voyageur'
  return {
    id: `guest-${reservation.id}`,
    name: guestName,
    initials: initials(guestName),
    tone: resolveTone(`guest-${reservation.id}`),
  }
}

function compareMessagesByDate(a: RawReservationMessage, b: RawReservationMessage) {
  return toMs(a.sentAt) - toMs(b.sentAt)
}

export function ensureReservationThreadMessages(reservation: RawBookingReservation): RawReservationMessage[] {
  const persisted = reservation.messaging?.messages ?? []
  if (persisted.length) {
    return [
      ...persisted,
    ].sort(compareMessagesByDate)
  }

  const seedBody = reservation.message?.trim() ?? ''
  if (!seedBody) return []

  const sentAt = toIsoDateTime(reservation.createdAt) ?? toIsoDateMidday(reservation.start) ?? new Date().toISOString()

  return [
    {
      id: `seed-${reservation.id}`,
      author: 'guest',
      body: seedBody,
      sentAt,
      state: 'read',
    },
  ]
}

export function createOutgoingReservationMessage(reservation: RawBookingReservation, body: string, sentAt = new Date().toISOString()): RawReservationMessage {
  const normalizedSentAt = toIsoDateTime(sentAt) ?? new Date().toISOString()
  const idSuffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36)

  return {
    id: `message-${reservation.id}-${idSuffix}`,
    author: 'host',
    body: body.trim(),
    sentAt: normalizedSentAt,
    state: 'sent',
  }
}

export function markIncomingMessagesRead(messages: RawReservationMessage[]): {
  changed: boolean
  messages: RawReservationMessage[]
} {
  let changed = false
  const nextMessages: RawReservationMessage[] = messages.map((message): RawReservationMessage => {
    if (message.author !== 'guest' || message.state === 'read') return message
    changed = true
    return {
      ...message,
      state: 'read',
    }
  })

  return {
    changed,
    messages: nextMessages,
  }
}

export function markLatestIncomingMessageUnread(messages: RawReservationMessage[]): {
  changed: boolean
  messages: RawReservationMessage[]
} {
  const nextMessages: RawReservationMessage[] = [
    ...messages,
  ]
  for (let index = nextMessages.length - 1; index >= 0; index -= 1) {
    const message = nextMessages[index]
    if (message.author !== 'guest') continue
    if (message.state !== 'read') {
      return {
        changed: false,
        messages: nextMessages,
      }
    }

    nextMessages[index] = {
      ...message,
      state: 'delivered',
    }

    return {
      changed: true,
      messages: nextMessages,
    }
  }

  return {
    changed: false,
    messages: nextMessages,
  }
}

function toConversationMessage(message: RawReservationMessage, referenceDate = new Date()): MessagingMessage {
  return {
    id: message.id,
    author: message.author,
    direction: message.author === 'host' ? 'outgoing' : 'incoming',
    body: message.body,
    sentAt: message.sentAt,
    sentAtLabel: formatConversationTime(message.sentAt, referenceDate),
    state: message.state,
  }
}

function countUnread(messages: MessagingMessage[]) {
  return messages.filter((message) => message.direction === 'incoming' && message.state !== 'read').length
}

export function buildMessagingConversations({ listings, reservationsByListingId, hostsByListingId }: { listings: UserListingCard[]; reservationsByListingId: Record<string, RawBookingReservation[]>; hostsByListingId: Record<string, Partial<RawHost> | null | undefined> }): MessagingConversation[] {
  const referenceDate = new Date()
  const conversations: MessagingConversation[] = []

  for (const listing of listings) {
    const listingId = listing.listingId
    const reservations = reservationsByListingId[listingId] ?? []
    const host = hostsByListingId[listingId] ?? null

    for (const reservation of reservations) {
      const hostParticipant = buildHostParticipant(listingId, host)
      const guestParticipant = buildGuestParticipant(reservation)

      const rawMessages = ensureReservationThreadMessages(reservation)
      const messages = rawMessages.map((message) => toConversationMessage(message, referenceDate))
      const lastMessage = messages[messages.length - 1] ?? null

      const lastSentAt = lastMessage?.sentAt ?? toIsoDateTime(reservation.createdAt) ?? toIsoDateMidday(reservation.start) ?? new Date(0).toISOString()

      const { conversationStatus, reservationStatusLabel } = deriveConversationStatus(listing, reservation, referenceDate)

      const unreadCount = countUnread(messages)
      const guestCount = Math.max(1, sumGuests(reservation))
      const total = Number(reservation.payment?.total ?? 0) || 0
      const lastPreview = lastMessage?.body?.trim() || reservation.message?.trim() || 'Aucun message'

      const searchIndex = normalizeSearch(
        [
          guestParticipant.name,
          listing.title ?? '',
          reservation.id,
          deriveReservationCode(reservation.id),
          reservationStatusLabel,
          reservation.start,
          reservation.end,
          reservation.payment?.status ?? '',
          reservation.contact?.firstName ?? '',
          reservation.contact?.lastName ?? '',
          reservation.contact?.email ?? '',
          reservation.contact?.phone ?? '',
        ].join(' '),
      )

      conversations.push({
        id: `${listingId}::${reservation.id}`,
        listingId,
        reservationId: reservation.id,
        status: conversationStatus,
        isPinned: unreadCount > 0,
        unreadCount,
        updatedAt: lastSentAt,
        updatedAtLabel: formatConversationTime(lastSentAt, referenceDate),
        searchIndex,
        listing: {
          id: listingId,
          title: listing.title ?? 'Annonce sans titre',
          location: '',
          cover: listing.coverSrc ?? listing.images?.[0]?.src ?? '',
        },
        reservation: {
          id: reservation.id,
          code: deriveReservationCode(reservation.id),
          status: reservationStatusLabel,
          startISO: reservation.start,
          endISO: reservation.end,
          startDate: formatReservationDate(reservation.start),
          endDate: formatReservationDate(reservation.end),
          nights: reservation.nights,
          guests: guestCount,
          total: formatAmount(total),
          currency: 'EUR',
          source: 'IndieHost',
          paymentStatus: reservation.payment?.status ?? 'pending',
        },
        participants: {
          host: hostParticipant,
          guest: guestParticipant,
        },
        lastMessage: {
          author: lastMessage?.author ?? 'guest',
          preview: truncatePreview(lastPreview),
          sentAt: lastSentAt,
          sentAtLabel: formatConversationTime(lastSentAt, referenceDate),
          state: (lastMessage?.state ?? 'read') as RawReservationMessageState,
        },
        messages,
      })
    }
  }

  return conversations.sort((a, b) => toMs(b.updatedAt) - toMs(a.updatedAt))
}
