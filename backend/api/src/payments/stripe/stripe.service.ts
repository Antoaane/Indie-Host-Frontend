import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Stripe from 'stripe'

type StripePaymentIntentRequest = {
  amount: number
  currency: string
  connectedAccountId: string
  metadata: Record<string, string>
}

type StripePaymentIntentResponse = {
  id: string
  clientSecret: string
  status: string
  currency: string
  connectedAccountId: string
}

@Injectable()
export class StripeService {
  private readonly stripe: Stripe | null

  constructor(private readonly configService: ConfigService) {
    const key = this.configService.get<string>('stripe.secretKey')?.trim()
    this.stripe = key ? new Stripe(key) : null
  }

  async createConnectPaymentIntent(input: StripePaymentIntentRequest): Promise<StripePaymentIntentResponse> {
    if (!this.stripe) {
      const mockId = `pi_mock_${Date.now()}`
      return {
        id: mockId,
        clientSecret: `${mockId}_secret_mock`,
        status: 'requires_payment_method',
        currency: input.currency,
        connectedAccountId: input.connectedAccountId,
      }
    }

    const intent = await this.stripe.paymentIntents.create({
      amount: Math.max(1, Math.trunc(input.amount)),
      currency: input.currency,
      automatic_payment_methods: {
        enabled: true,
      },
      transfer_data: {
        destination: input.connectedAccountId,
      },
      metadata: input.metadata,
    })

    return {
      id: intent.id,
      clientSecret: intent.client_secret ?? '',
      status: intent.status,
      currency: intent.currency,
      connectedAccountId: input.connectedAccountId,
    }
  }

  async createAccountOnboardingLink({
    accountId,
    refreshUrl,
    returnUrl,
    type,
  }: {
    accountId: string
    refreshUrl: string
    returnUrl: string
    type: 'account_onboarding' | 'account_update'
  }): Promise<{ url: string; expiresAt: number | null }> {
    if (!this.stripe) {
      return {
        url: `${returnUrl}?mockConnectAccount=${accountId}`,
        expiresAt: null,
      }
    }

    const link = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type,
    })

    return {
      url: link.url,
      expiresAt: link.expires_at ?? null,
    }
  }

  async getAccountStatus(accountId: string) {
    if (!this.stripe) {
      return {
        accountId,
        onboardingStatus: 'not_started',
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      }
    }

    const account = await this.stripe.accounts.retrieve(accountId)

    return {
      accountId: account.id,
      onboardingStatus: account.details_submitted ? 'completed' : 'pending',
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
      detailsSubmitted: Boolean(account.details_submitted),
      defaultCurrency: account.default_currency ?? null,
      requirements: account.requirements,
    }
  }
}
