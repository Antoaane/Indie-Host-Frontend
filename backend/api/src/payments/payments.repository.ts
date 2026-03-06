import { Injectable, NotFoundException } from '@nestjs/common'
import { DeferredMode, PaymentChoice } from '@prisma/client'

import { PrismaService } from '@/common/prisma/prisma.service'
import type { AuthUser } from '@/auth/interfaces/auth-user.interface'
import type { CreateStripePaymentIntentDto } from '@/payments/dto/create-stripe-payment-intent.dto'

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async resolveListingByPublicId(listingPublicId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { publicId: listingPublicId },
    })

    if (!listing) {
      throw new NotFoundException(`Listing ${listingPublicId} not found`)
    }

    return listing
  }

  async saveStripePaymentIntent({
    stripePaymentIntentId,
    clientSecret,
    status,
    input,
    authUser,
  }: {
    stripePaymentIntentId: string
    clientSecret: string
    status: string
    input: CreateStripePaymentIntentDto
    authUser: AuthUser | null
  }) {
    const listing = await this.resolveListingByPublicId(input.listingId)

    const createdByUser = authUser?.userId
      ? await this.prisma.user.upsert({
          where: { clerkUserId: authUser.userId },
          update: {},
          create: {
            clerkUserId: authUser.userId,
            email: authUser.email,
            role: 'HOST',
          },
        })
      : null

    const deferredDueDateISO = input.payment.deferredDueDateISO?.trim()

    await this.prisma.paymentIntent.upsert({
      where: {
        stripePaymentIntentId,
      },
      update: {
        listingId: listing.id,
        createdByUserId: createdByUser?.id,
        connectedAccountId: input.connectedAccountId,
        currency: (input.currency ?? 'eur').toLowerCase(),
        paymentChoice: mapPaymentChoice(input.payment.choice),
        amountTotal: input.payment.totalAmount,
        amountChargeNow: input.payment.chargeNowAmount,
        amountDeferred: input.payment.deferredAmount,
        deferredMode: mapDeferredMode(input.payment.deferredMode),
        deferredDueDate: deferredDueDateISO ? new Date(`${deferredDueDateISO.slice(0, 10)}T00:00:00.000Z`) : null,
        status,
        clientSecret,
        metadata: input.metadata ?? {},
      },
      create: {
        stripePaymentIntentId,
        listingId: listing.id,
        createdByUserId: createdByUser?.id,
        connectedAccountId: input.connectedAccountId,
        currency: (input.currency ?? 'eur').toLowerCase(),
        paymentChoice: mapPaymentChoice(input.payment.choice),
        amountTotal: input.payment.totalAmount,
        amountChargeNow: input.payment.chargeNowAmount,
        amountDeferred: input.payment.deferredAmount,
        deferredMode: mapDeferredMode(input.payment.deferredMode),
        deferredDueDate: deferredDueDateISO ? new Date(`${deferredDueDateISO.slice(0, 10)}T00:00:00.000Z`) : null,
        status,
        clientSecret,
        metadata: input.metadata ?? {},
      },
    })
  }
}

function mapPaymentChoice(choice: 'full' | 'split' | 'cash'): PaymentChoice {
  if (choice === 'split') return PaymentChoice.SPLIT
  if (choice === 'cash') return PaymentChoice.CASH
  return PaymentChoice.FULL
}

function mapDeferredMode(mode: 'none' | 'online' | 'cash'): DeferredMode {
  if (mode === 'online') return DeferredMode.ONLINE
  if (mode === 'cash') return DeferredMode.CASH
  return DeferredMode.NONE
}
