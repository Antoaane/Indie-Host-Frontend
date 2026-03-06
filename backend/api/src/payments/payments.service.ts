import { Injectable } from '@nestjs/common'

import type { AuthUser } from '@/auth/interfaces/auth-user.interface'
import type { CreateConnectOnboardingLinkDto } from '@/payments/dto/create-connect-onboarding-link.dto'
import type { CreateStripePaymentIntentDto } from '@/payments/dto/create-stripe-payment-intent.dto'
import { PaymentsRepository } from '@/payments/payments.repository'
import { StripeService } from '@/payments/stripe/stripe.service'

@Injectable()
export class PaymentsService {
  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly stripeService: StripeService,
  ) {}

  async createStripePaymentIntent(input: CreateStripePaymentIntentDto, authUser: AuthUser | null) {
    const currency = (input.currency ?? 'eur').toLowerCase()

    const metadata = {
      listing_id: input.listingId,
      reservation_start: input.reservation.startISO,
      reservation_end: input.reservation.endISO,
      reservation_nights: String(input.reservation.nights),
      payment_choice: input.payment.choice,
      payment_total_amount: String(input.payment.totalAmount),
      payment_charge_now_amount: String(input.payment.chargeNowAmount),
      payment_deferred_amount: String(input.payment.deferredAmount),
      payment_deferred_mode: input.payment.deferredMode,
      ...input.metadata,
    }

    const stripeIntent = await this.stripeService.createConnectPaymentIntent({
      amount: input.payment.chargeNowAmount > 0 ? input.payment.chargeNowAmount : input.payment.totalAmount,
      connectedAccountId: input.connectedAccountId,
      currency,
      metadata,
    })

    await this.paymentsRepository.saveStripePaymentIntent({
      stripePaymentIntentId: stripeIntent.id,
      clientSecret: stripeIntent.clientSecret,
      status: stripeIntent.status,
      input,
      authUser,
    })

    return {
      paymentIntentId: stripeIntent.id,
      clientSecret: stripeIntent.clientSecret,
      status: stripeIntent.status,
      currency: stripeIntent.currency,
      connectedAccountId: stripeIntent.connectedAccountId,
    }
  }

  async createConnectOnboardingLink(accountId: string, payload: CreateConnectOnboardingLinkDto) {
    const refreshUrl = payload.refreshUrl ?? 'http://localhost:5179/stripe/connect/refresh'
    const returnUrl = payload.returnUrl ?? 'http://localhost:5179/stripe/connect/return'
    const type = payload.type === 'account_update' ? 'account_update' : 'account_onboarding'

    return this.stripeService.createAccountOnboardingLink({
      accountId,
      refreshUrl,
      returnUrl,
      type,
    })
  }

  async getConnectAccountStatus(accountId: string) {
    return this.stripeService.getAccountStatus(accountId)
  }
}
