import { Injectable, NotFoundException } from '@nestjs/common'
import { MessageAuthorRole, MessageState, Prisma, ReservationStatus, type Listing } from '@prisma/client'

import { PrismaService } from '@/common/prisma/prisma.service'
import { nightsBetween, toDateAtUtcMidnight } from '@/shared/date.utils'
import { createConversationPublicId, createMessagePublicId, createReservationPublicId } from '@/shared/id.utils'
import { asObject, deepMerge, isPlainObject, toNonNegativeInt, toStringOrEmpty } from '@/shared/json.utils'

@Injectable()
export class BookingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async findListingOrThrow(listingPublicId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { publicId: listingPublicId },
    })

    if (!listing) {
      throw new NotFoundException(`Listing ${listingPublicId} not found`)
    }

    return listing
  }

  async getBookingsResource(listingPublicId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { publicId: listingPublicId },
      include: {
        bookings: true,
      },
    })

    if (!listing) {
      throw new NotFoundException(`Listing ${listingPublicId} not found`)
    }

    const base = asObject(listing.bookings?.data)
    return this.hydrateBookingsWithReservations(listing.id, base)
  }

  async patchBookingsResource(listingPublicId: string, patch: Record<string, unknown>) {
    const listing = await this.findListingOrThrow(listingPublicId)

    const existing = await this.prisma.listingBookings.findUnique({
      where: { listingId: listing.id },
    })

    const merged = deepMerge(asObject(existing?.data), patch)

    await this.prisma.$transaction(async (tx) => {
      await tx.listingBookings.upsert({
        where: { listingId: listing.id },
        update: { data: merged },
        create: { listingId: listing.id, data: merged },
      })

      await tx.listing.update({
        where: { id: listing.id },
        data: { hasPendingChanges: true },
      })

      await this.syncReservationsFromBookingsPayload(tx, listing, merged, patch)
    })

    return this.getBookingsResource(listingPublicId)
  }

  private async hydrateBookingsWithReservations(listingId: string, base: Record<string, unknown>) {
    const reservations = await this.prisma.reservation.findMany({
      where: { listingId },
      include: {
        conversation: {
          include: {
            messages: {
              orderBy: { sentAt: 'asc' },
            },
          },
        },
      },
      orderBy: { startDate: 'asc' },
    })

    if (!reservations.length) return base

    const mappedReservations = reservations.map((reservation) => {
      const messages = reservation.conversation?.messages ?? []

      const messaging = {
        conversationId: reservation.conversation?.publicId,
        messages: messages.map((message) => ({
          id: message.publicId,
          author: mapAuthorRole(message.authorRole),
          body: message.body,
          sentAt: message.sentAt.toISOString(),
          state: mapMessageState(message.state),
        })),
      }

      return {
        id: reservation.publicId,
        start: reservation.startDate.toISOString().slice(0, 10),
        end: reservation.endDate.toISOString().slice(0, 10),
        nights: reservation.nights,
        guestName: reservation.guestName,
        guestAvatar: reservation.guestAvatarUrl ?? undefined,
        message: reservation.guestMessage ?? '',
        internalNote: reservation.internalNote ?? undefined,
        guests: asObject(reservation.guests),
        payment: asObject(reservation.payment),
        contact: asObject(reservation.contact),
        createdAt: reservation.createdAt.toISOString(),
        messaging,
      }
    })

    const next: Record<string, unknown> = {
      ...base,
      reservations: mappedReservations,
    }

    const existingBookedDays = Array.isArray(base['booked-days']) ? base['booked-days'] : []
    if (existingBookedDays.length === 0) {
      next['booked-days'] = mappedReservations.map((reservation) => ({
        start: toStringOrEmpty(reservation.start),
        end: toStringOrEmpty(reservation.end),
      }))
    }

    return next
  }

  private async syncReservationsFromBookingsPayload(
    tx: Prisma.TransactionClient,
    listing: Listing,
    bookings: Record<string, unknown>,
    patch: Record<string, unknown>,
  ) {
    const shouldSyncReservations = Object.prototype.hasOwnProperty.call(patch, 'reservations')
    if (!shouldSyncReservations) {
      return
    }

    const reservations = Array.isArray(bookings.reservations)
      ? bookings.reservations.filter((entry): entry is Record<string, unknown> => isPlainObject(entry))
      : []

    if (!reservations.length) {
      await tx.reservation.deleteMany({
        where: { listingId: listing.id },
      })
      return
    }

    const retainedPublicIds: string[] = []

    for (const entry of reservations) {
      const start = toStringOrEmpty(entry.start)
      const end = toStringOrEmpty(entry.end)
      if (!start || !end) continue

      const publicId = toStringOrEmpty(entry.id) || createReservationPublicId(listing.publicId, start, end)
      retainedPublicIds.push(publicId)

      const upserted = await tx.reservation.upsert({
        where: { publicId },
        update: {
          listingId: listing.id,
          startDate: toDateAtUtcMidnight(start),
          endDate: toDateAtUtcMidnight(end),
          nights: toNonNegativeInt(entry.nights, nightsBetween(start, end)),
          guestName: toStringOrEmpty(entry.guestName) || 'Voyageur',
          guestAvatarUrl: toStringOrEmpty(entry.guestAvatar) || null,
          guestMessage: toStringOrEmpty(entry.message) || null,
          internalNote: toStringOrEmpty(entry.internalNote) || null,
          guests: asObject(entry.guests),
          payment: asObject(entry.payment),
          contact: asObject(entry.contact),
          status: resolveReservationStatus(entry),
        },
        create: {
          publicId,
          listingId: listing.id,
          source: 'DIRECT',
          status: resolveReservationStatus(entry),
          startDate: toDateAtUtcMidnight(start),
          endDate: toDateAtUtcMidnight(end),
          nights: toNonNegativeInt(entry.nights, nightsBetween(start, end)),
          guestName: toStringOrEmpty(entry.guestName) || 'Voyageur',
          guestAvatarUrl: toStringOrEmpty(entry.guestAvatar) || null,
          guestMessage: toStringOrEmpty(entry.message) || null,
          internalNote: toStringOrEmpty(entry.internalNote) || null,
          guests: asObject(entry.guests),
          payment: asObject(entry.payment),
          contact: asObject(entry.contact),
        },
      })

      await this.syncConversationAndMessages(tx, listing, upserted.id, upserted.publicId, entry)
    }

    await tx.reservation.deleteMany({
      where: {
        listingId: listing.id,
        publicId: {
          notIn: retainedPublicIds,
        },
      },
    })
  }

  private async syncConversationAndMessages(
    tx: Prisma.TransactionClient,
    listing: Listing,
    reservationId: string,
    reservationPublicId: string,
    reservationPayload: Record<string, unknown>,
  ) {
    const messaging = isPlainObject(reservationPayload.messaging)
      ? reservationPayload.messaging
      : null

    const conversationPublicId =
      toStringOrEmpty(messaging?.conversationId) ||
      createConversationPublicId(listing.publicId, reservationPublicId)

    const conversation = await tx.conversation.upsert({
      where: {
        publicId: conversationPublicId,
      },
      update: {
        listingId: listing.id,
        reservationId,
      },
      create: {
        publicId: conversationPublicId,
        listingId: listing.id,
        reservationId,
      },
    })

    const hostParticipantId = `${conversation.id}:host:${listing.ownerId ?? 'unassigned'}`

    await tx.conversationParticipant.upsert({
      where: {
        id: hostParticipantId,
      },
      update: {
        role: 'HOST',
        userId: listing.ownerId,
        displayName: 'Hôte',
      },
      create: {
        id: hostParticipantId,
        conversationId: conversation.id,
        role: 'HOST',
        userId: listing.ownerId,
        displayName: 'Hôte',
      },
    })

    const messages = Array.isArray(messaging?.messages)
      ? messaging.messages.filter((entry): entry is Record<string, unknown> => isPlainObject(entry))
      : []

    await tx.message.deleteMany({
      where: { conversationId: conversation.id },
    })

    for (const message of messages) {
      const messagePublicId = toStringOrEmpty(message.id) || createMessagePublicId(conversation.publicId)
      const sentAt = toStringOrEmpty(message.sentAt)

      await tx.message.create({
        data: {
          publicId: messagePublicId,
          conversationId: conversation.id,
          reservationId,
          authorRole: mapMessageAuthor(message.author),
          userId: mapMessageAuthor(message.author) === MessageAuthorRole.HOST ? listing.ownerId : null,
          body: toStringOrEmpty(message.body),
          state: mapMessageStateDb(message.state),
          sentAt: sentAt ? new Date(sentAt) : new Date(),
        },
      })
    }
  }
}

function resolveReservationStatus(entry: Record<string, unknown>): ReservationStatus {
  const payment = asObject(entry.payment)
  const paymentStatus = toStringOrEmpty(payment.status).toLowerCase()
  if (paymentStatus === 'paid') return ReservationStatus.CONFIRMED
  return ReservationStatus.PENDING
}

function mapMessageAuthor(author: unknown): MessageAuthorRole {
  const normalized = toStringOrEmpty(author).toLowerCase()
  if (normalized === 'guest') return MessageAuthorRole.GUEST
  return MessageAuthorRole.HOST
}

function mapMessageStateDb(state: unknown): MessageState {
  const normalized = toStringOrEmpty(state).toLowerCase()
  if (normalized === 'read') return MessageState.READ
  if (normalized === 'delivered') return MessageState.DELIVERED
  return MessageState.SENT
}

function mapAuthorRole(authorRole: MessageAuthorRole): 'host' | 'guest' {
  if (authorRole === MessageAuthorRole.GUEST) return 'guest'
  return 'host'
}

function mapMessageState(state: MessageState): 'sent' | 'delivered' | 'read' {
  if (state === MessageState.READ) return 'read'
  if (state === MessageState.DELIVERED) return 'delivered'
  return 'sent'
}
