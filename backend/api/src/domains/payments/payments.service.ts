import type { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

import { env } from '../../config/env.js';
import { toPrismaJson } from '../../lib/prisma.js';
import type { RequestAuth } from '../../types/auth.js';
import { upsertUserFromAuth } from '../users/users.repository.js';

type CreatePaymentIntentInput = {
  listingId: string;
  connectedAccountId: string;
  currency: string;
  reservation: Record<string, unknown>;
  payment: {
    choice: string;
    totalAmount: number;
    chargeNowAmount: number;
    deferredAmount?: number;
    deferredMode?: string;
    deferredDueDateISO?: string | null;
  };
  metadata?: Record<string, string>;
};

type CreateConnectOnboardingLinkInput = {
  accountId?: string;
  refreshUrl: string;
  returnUrl: string;
  country?: string;
};

function toMinorUnit(amount: number): number {
  const normalized = Number.isFinite(amount) ? amount : 0;
  return Math.max(0, Math.round(normalized * 100));
}

export class PaymentsService {
  private readonly stripe: Stripe | null;

  constructor(private readonly prisma: PrismaClient) {
    this.stripe = env.STRIPE_SECRET_KEY
      ? new Stripe(env.STRIPE_SECRET_KEY, {
          apiVersion: '2025-02-24.acacia',
        })
      : null;
  }

  private computeApplicationFee(amountMinor: number): number {
    if (amountMinor <= 0) return 0;
    if (env.STRIPE_CONNECT_PLATFORM_FEE_BPS <= 0) return 0;
    return Math.max(0, Math.round((amountMinor * env.STRIPE_CONNECT_PLATFORM_FEE_BPS) / 10000));
  }

  async createPaymentIntent(input: CreatePaymentIntentInput, auth: RequestAuth | null) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: input.listingId },
      select: { id: true, ownerId: true },
    });

    if (!listing) return null;

    const actor = await upsertUserFromAuth(this.prisma, auth);
    const currency = (input.currency || 'eur').toLowerCase();
    const chargeNowAmountMinor = toMinorUnit(input.payment.chargeNowAmount);
    if (chargeNowAmountMinor <= 0) {
      throw new Error('chargeNowAmount must be greater than 0.');
    }

    const metadata: Record<string, string> = {
      listingId: input.listingId,
      connectedAccountId: input.connectedAccountId,
      paymentChoice: input.payment.choice,
      ...(input.metadata ?? {}),
    };

    let session: {
      id: string;
      clientSecret: string;
      status: string;
      currency: string;
      connectedAccountId: string;
      rawResponse: Record<string, unknown>;
    };

    if (!this.stripe) {
      const idSuffix = Math.random().toString(36).slice(2, 10);
      const fakeId = `pi_mock_${idSuffix}`;
      session = {
        id: fakeId,
        clientSecret: `${fakeId}_secret_mock`,
        status: 'requires_payment_method',
        currency,
        connectedAccountId: input.connectedAccountId,
        rawResponse: {
          mode: 'mock',
          message: 'Stripe key not configured.',
        },
      };
    } else {
      const applicationFee = this.computeApplicationFee(chargeNowAmountMinor);

      const createParams: Stripe.PaymentIntentCreateParams = {
        amount: chargeNowAmountMinor,
        currency,
        automatic_payment_methods: {
          enabled: true,
        },
        metadata,
      };

      if (input.connectedAccountId) {
        createParams.transfer_data = {
          destination: input.connectedAccountId,
        };

        if (applicationFee > 0) {
          createParams.application_fee_amount = applicationFee;
        }
      }

      const intent = await this.stripe.paymentIntents.create(createParams);

      if (!intent.client_secret) {
        throw new Error('Stripe did not return a client_secret.');
      }

      session = {
        id: intent.id,
        clientSecret: intent.client_secret,
        status: intent.status,
        currency: intent.currency,
        connectedAccountId: input.connectedAccountId,
        rawResponse: intent as unknown as Record<string, unknown>,
      };
    }

    await this.prisma.payment.create({
      data: {
        listingId: input.listingId,
        userId: actor?.id ?? listing.ownerId ?? null,
        stripePaymentIntentId: session.id,
        stripeConnectedAccountId: input.connectedAccountId,
        currency,
        amountMinor: chargeNowAmountMinor,
        status: session.status,
        paymentChoice: input.payment.choice,
        chargeNowAmountMinor,
        deferredAmountMinor: toMinorUnit(input.payment.deferredAmount ?? 0),
        deferredMode: input.payment.deferredMode ?? null,
        deferredDueDate: input.payment.deferredDueDateISO ? new Date(input.payment.deferredDueDateISO) : null,
        metadata: toPrismaJson(metadata),
        rawRequest: toPrismaJson({
          reservation: input.reservation,
          payment: input.payment,
          currency,
        }),
        rawResponse: toPrismaJson(session.rawResponse),
      },
    });

    return {
      id: session.id,
      clientSecret: session.clientSecret,
      status: session.status,
      currency: session.currency,
      connectedAccountId: session.connectedAccountId,
    };
  }

  async createConnectOnboardingLink(input: CreateConnectOnboardingLinkInput, auth: RequestAuth | null) {
    const user = await upsertUserFromAuth(this.prisma, auth);
    if (!user) return null;

    if (!this.stripe) {
      const fakeAccountId = input.accountId ?? `acct_mock_${Math.random().toString(36).slice(2, 10)}`;
      const fakeUrl = `${input.returnUrl}?account=${fakeAccountId}&mode=mock`;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          stripeConnectAccountId: fakeAccountId,
          stripeConnectProfile: toPrismaJson({
            accountId: fakeAccountId,
            onboardingStatus: 'pending',
            chargesEnabled: false,
            payoutsEnabled: false,
            defaultCurrency: 'eur',
            transferSchedule: 'manual',
          }),
        },
      });

      return {
        accountId: fakeAccountId,
        url: fakeUrl,
        mode: 'mock',
      };
    }

    let accountId = input.accountId || user.stripeConnectAccountId;

    if (!accountId) {
      const account = await this.stripe.accounts.create({
        type: 'express',
        country: input.country?.toUpperCase() ?? 'FR',
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
        metadata: {
          userId: user.id,
          clerkUserId: user.clerkUserId ?? '',
        },
      });

      accountId = account.id;
    }

    const accountLink = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: input.refreshUrl,
      return_url: input.returnUrl,
      type: 'account_onboarding',
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        stripeConnectAccountId: accountId,
        stripeConnectProfile: toPrismaJson({
          accountId,
          onboardingStatus: 'pending',
          chargesEnabled: false,
          payoutsEnabled: false,
          defaultCurrency: 'eur',
          transferSchedule: 'manual',
        }),
      },
    });

    return {
      accountId,
      url: accountLink.url,
      expiresAt: accountLink.expires_at,
      mode: 'live',
    };
  }

  async getMyStripeConnectProfile(auth: RequestAuth | null) {
    const user = await upsertUserFromAuth(this.prisma, auth);
    if (!user) return null;

    return {
      accountId: user.stripeConnectAccountId,
      profile: user.stripeConnectProfile,
    };
  }
}
