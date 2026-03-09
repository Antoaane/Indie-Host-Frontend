import type { PrismaClient, User } from '@prisma/client';
import Stripe from 'stripe';

import { env } from '../../config/env.js';
import { asObject } from '../../lib/json.js';
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

export type SubscriptionPlanCode = 'indiehost' | 'superhost' | 'megahost';

export type SubscriptionPlan = {
  code: SubscriptionPlanCode;
  name: string;
  description: string;
  maxActiveListings: number;
  currency: string;
  monthlyPriceMinor: number;
  billingInterval: string;
  stripePriceId: string | null;
  available: boolean;
  unavailableReason: string | null;
};

type ActivateSubscriptionInput = {
  planCode: SubscriptionPlanCode;
  successUrl: string;
  cancelUrl: string;
};

type ConfirmCheckoutInput = {
  sessionId: string;
  planCode?: SubscriptionPlanCode;
};

type ConnectSummary = {
  accountId: string | null;
  onboardingStatus: string;
  createdInFlow: boolean;
};

type BillingSnapshot = {
  customerId: string | null;
  subscriptionId: string | null;
  planCode: SubscriptionPlanCode | null;
  status: string | null;
  currentPeriodEndISO: string | null;
  cancelAtPeriodEnd: boolean;
  updatedAtISO: string | null;
  pendingPlanCode: SubscriptionPlanCode | null;
  pendingCheckoutSessionId: string | null;
};

type PublicBillingSnapshot = {
  subscriptionId: string | null;
  planCode: SubscriptionPlanCode | null;
  status: string | null;
  currentPeriodEndISO: string | null;
  cancelAtPeriodEnd: boolean;
  updatedAtISO: string | null;
  pendingPlanCode: SubscriptionPlanCode | null;
  pendingCheckoutSessionId: string | null;
};

export type SubscriptionActivationResult = {
  state: 'plan_unavailable' | 'checkout_required' | 'updated' | 'already_active';
  mode: 'live' | 'mock';
  plan: SubscriptionPlan | null;
  subscription: PublicBillingSnapshot | null;
  connect: ConnectSummary;
  checkout: {
    sessionId: string;
    url: string;
  } | null;
  message: string | null;
};

export type ConfirmSubscriptionCheckoutResult = {
  state: 'confirmed' | 'not_found';
  mode: 'live' | 'mock';
  plan: SubscriptionPlan | null;
  subscription: PublicBillingSnapshot | null;
  connect: ConnectSummary;
  message: string | null;
};

export type MySubscriptionStateResult = {
  mode: 'live' | 'mock';
  plans: SubscriptionPlan[];
  currentPlanCode: SubscriptionPlanCode | null;
  currentPlan: SubscriptionPlan | null;
  subscription: PublicBillingSnapshot | null;
  connect: Omit<ConnectSummary, 'createdInFlow'>;
};

type PlanTemplate = {
  name: string;
  description: string;
  maxActiveListings: number;
  defaultCurrency: string;
  defaultMonthlyPriceMinor: number;
};

const PLAN_CODES: SubscriptionPlanCode[] = [
  'indiehost',
  'superhost',
  'megahost',
];

const PLAN_TEMPLATES: Record<SubscriptionPlanCode, PlanTemplate> = {
  indiehost: {
    name: 'IndieHost',
    description: 'Plan de base pour démarrer sans commission.',
    maxActiveListings: 2,
    defaultCurrency: 'eur',
    defaultMonthlyPriceMinor: 0,
  },
  superhost: {
    name: 'SuperHost',
    description: 'Plan pour les hôtes semi-pro avec plus de capacité.',
    maxActiveListings: 5,
    defaultCurrency: 'eur',
    defaultMonthlyPriceMinor: 2900,
  },
  megahost: {
    name: 'MegaHost',
    description: 'Plan avancé pour les portefeuilles professionnels.',
    maxActiveListings: 15,
    defaultCurrency: 'eur',
    defaultMonthlyPriceMinor: 7900,
  },
};

const PLAN_PRICE_ENV_KEYS: Record<SubscriptionPlanCode, keyof typeof env> = {
  indiehost: 'STRIPE_BILLING_PRICE_INDIEHOST',
  superhost: 'STRIPE_BILLING_PRICE_SUPERHOST',
  megahost: 'STRIPE_BILLING_PRICE_MEGAHOST',
};

const ONGOING_SUBSCRIPTION_STATUSES = new Set([
  'trialing',
  'active',
  'past_due',
  'unpaid',
  'incomplete',
]);

function toMinorUnit(amount: number): number {
  const normalized = Number.isFinite(amount) ? amount : 0;
  return Math.max(0, Math.round(normalized * 100));
}

function generateMockId(prefix: string): string {
  return `${prefix}${Math.random().toString(36).slice(2, 10)}`;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function readBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function normalizePlanCode(value: unknown): SubscriptionPlanCode | null {
  const raw = readString(value);
  if (!raw) return null;
  if (raw === 'indiehost' || raw === 'superhost' || raw === 'megahost') return raw;
  return null;
}

function toIsoFromUnixSeconds(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return new Date(value * 1000).toISOString();
}

function addQueryParam(url: string, key: string, value: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has(key)) {
      parsed.searchParams.set(key, value);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function applyDefinedPatch(base: Record<string, unknown>, patch?: Record<string, unknown>): Record<string, unknown> {
  if (!patch) return { ...base };

  const output: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    output[key] = value;
  }

  return output;
}

function nowIso(): string {
  return new Date().toISOString();
}

function oneMonthFromNowIso(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

function isSubscriptionOngoing(status: string | null): boolean {
  if (!status) return false;
  return ONGOING_SUBSCRIPTION_STATUSES.has(status);
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

  private getExecutionMode(): 'live' | 'mock' {
    return this.stripe ? 'live' : 'mock';
  }

  private computeApplicationFee(amountMinor: number): number {
    if (amountMinor <= 0) return 0;
    if (env.STRIPE_CONNECT_PLATFORM_FEE_BPS <= 0) return 0;
    return Math.max(0, Math.round((amountMinor * env.STRIPE_CONNECT_PLATFORM_FEE_BPS) / 10000));
  }

  private readStripeProfile(user: User): Record<string, unknown> {
    return asObject(user.stripeConnectProfile);
  }

  private readBillingSnapshot(user: User): BillingSnapshot {
    const profile = this.readStripeProfile(user);
    const billing = asObject(profile.billing);

    return {
      customerId: readString(billing.customerId),
      subscriptionId: readString(billing.subscriptionId),
      planCode: normalizePlanCode(billing.planCode),
      status: readString(billing.status),
      currentPeriodEndISO: readString(billing.currentPeriodEndISO),
      cancelAtPeriodEnd: readBoolean(billing.cancelAtPeriodEnd, false),
      updatedAtISO: readString(billing.updatedAtISO),
      pendingPlanCode: normalizePlanCode(billing.pendingPlanCode),
      pendingCheckoutSessionId: readString(billing.pendingCheckoutSessionId),
    };
  }

  private readConnectOnboardingStatus(user: User): string {
    const profile = this.readStripeProfile(user);
    const onboardingStatus = readString(profile.onboardingStatus);
    return onboardingStatus ?? 'not_started';
  }

  private toPublicBillingSnapshot(billing: BillingSnapshot | null): PublicBillingSnapshot | null {
    if (!billing) return null;

    return {
      subscriptionId: billing.subscriptionId,
      planCode: billing.planCode,
      status: billing.status,
      currentPeriodEndISO: billing.currentPeriodEndISO,
      cancelAtPeriodEnd: billing.cancelAtPeriodEnd,
      updatedAtISO: billing.updatedAtISO,
      pendingPlanCode: billing.pendingPlanCode,
      pendingCheckoutSessionId: billing.pendingCheckoutSessionId,
    };
  }

  private async updateUserStripeState({
    user,
    stripeConnectAccountId,
    connectPatch,
    billingPatch,
  }: {
    user: User;
    stripeConnectAccountId?: string | null;
    connectPatch?: Record<string, unknown>;
    billingPatch?: Partial<BillingSnapshot>;
  }): Promise<User> {
    const currentProfile = this.readStripeProfile(user);
    const currentBilling = asObject(currentProfile.billing);

    const nextBilling = applyDefinedPatch(currentBilling, {
      customerId: billingPatch?.customerId,
      subscriptionId: billingPatch?.subscriptionId,
      planCode: billingPatch?.planCode,
      status: billingPatch?.status,
      currentPeriodEndISO: billingPatch?.currentPeriodEndISO,
      cancelAtPeriodEnd: billingPatch?.cancelAtPeriodEnd,
      updatedAtISO: billingPatch?.updatedAtISO,
      pendingPlanCode: billingPatch?.pendingPlanCode,
      pendingCheckoutSessionId: billingPatch?.pendingCheckoutSessionId,
    });

    const nextProfile = applyDefinedPatch(currentProfile, connectPatch);
    nextProfile.billing = nextBilling;

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        stripeConnectAccountId: stripeConnectAccountId === undefined ? user.stripeConnectAccountId : stripeConnectAccountId,
        stripeConnectProfile: toPrismaJson(nextProfile),
      },
    });

    return updated;
  }

  private async ensureStripeConnectAccount(
    user: User,
    options?: { country?: string; forcedAccountId?: string | null },
  ): Promise<{ user: User; accountId: string; created: boolean }> {
    const forced = readString(options?.forcedAccountId ?? null);
    const currentAccountId = forced ?? user.stripeConnectAccountId ?? null;

    if (currentAccountId) {
      if (currentAccountId !== user.stripeConnectAccountId) {
        const next = await this.updateUserStripeState({
          user,
          stripeConnectAccountId: currentAccountId,
          connectPatch: {
            accountId: currentAccountId,
            onboardingStatus: this.readConnectOnboardingStatus(user),
          },
        });

        return {
          user: next,
          accountId: currentAccountId,
          created: false,
        };
      }

      return {
        user,
        accountId: currentAccountId,
        created: false,
      };
    }

    if (!this.stripe) {
      const accountId = generateMockId('acct_mock_');
      const next = await this.updateUserStripeState({
        user,
        stripeConnectAccountId: accountId,
        connectPatch: {
          accountId,
          onboardingStatus: 'pending',
          chargesEnabled: false,
          payoutsEnabled: false,
          defaultCurrency: 'eur',
          transferSchedule: 'manual',
        },
      });

      return {
        user: next,
        accountId,
        created: true,
      };
    }

    const account = await this.stripe.accounts.create({
      type: 'express',
      country: (options?.country ?? 'FR').toUpperCase(),
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      metadata: {
        userId: user.id,
        clerkUserId: user.clerkUserId ?? '',
      },
    });

    const next = await this.updateUserStripeState({
      user,
      stripeConnectAccountId: account.id,
      connectPatch: {
        accountId: account.id,
        onboardingStatus: 'pending',
        chargesEnabled: false,
        payoutsEnabled: false,
        defaultCurrency: (account.default_currency ?? 'eur').toLowerCase(),
        transferSchedule: 'manual',
      },
    });

    return {
      user: next,
      accountId: account.id,
      created: true,
    };
  }

  private async ensureStripeCustomer(user: User): Promise<{ user: User; customerId: string }> {
    const billing = this.readBillingSnapshot(user);
    if (billing.customerId) {
      return {
        user,
        customerId: billing.customerId,
      };
    }

    if (!this.stripe) {
      const customerId = generateMockId('cus_mock_');
      const next = await this.updateUserStripeState({
        user,
        billingPatch: {
          customerId,
          updatedAtISO: nowIso(),
        },
      });

      return {
        user: next,
        customerId,
      };
    }

    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    const customer = await this.stripe.customers.create({
      email: user.email ?? undefined,
      name: fullName || user.displayName || undefined,
      metadata: {
        userId: user.id,
        clerkUserId: user.clerkUserId ?? '',
      },
    });

    const next = await this.updateUserStripeState({
      user,
      billingPatch: {
        customerId: customer.id,
        updatedAtISO: nowIso(),
      },
    });

    return {
      user: next,
      customerId: customer.id,
    };
  }

  private resolvePlanByPriceId(plans: SubscriptionPlan[], priceId: string | null): SubscriptionPlanCode | null {
    if (!priceId) return null;
    const match = plans.find((plan) => plan.stripePriceId === priceId);
    return match?.code ?? null;
  }

  private serializeStripeSubscription(
    subscription: Stripe.Subscription,
    plans: SubscriptionPlan[],
    fallbackPlanCode?: SubscriptionPlanCode | null,
  ): BillingSnapshot {
    const priceId = subscription.items.data[0]?.price?.id ?? null;
    const planCode = this.resolvePlanByPriceId(plans, priceId) ?? fallbackPlanCode ?? null;

    return {
      customerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id ?? null,
      subscriptionId: subscription.id,
      planCode,
      status: subscription.status,
      currentPeriodEndISO: toIsoFromUnixSeconds(subscription.current_period_end),
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      updatedAtISO: nowIso(),
      pendingPlanCode: null,
      pendingCheckoutSessionId: null,
    };
  }

  private async getCurrentStripeSubscription({
    customerId,
    subscriptionId,
  }: {
    customerId: string;
    subscriptionId: string | null;
  }): Promise<Stripe.Subscription | null> {
    if (!this.stripe) return null;

    if (subscriptionId) {
      try {
        const fromId = await this.stripe.subscriptions.retrieve(subscriptionId);
        if (isSubscriptionOngoing(fromId.status)) {
          return fromId;
        }
      } catch {
        // ignored: fallback to listing by customer
      }
    }

    const listed = await this.stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 20,
    });

    const latestOngoing = listed.data.find((item) => isSubscriptionOngoing(item.status));
    return latestOngoing ?? null;
  }

  private async resolvePlanCatalog(): Promise<SubscriptionPlan[]> {
    const mode = this.getExecutionMode();

    const plans = await Promise.all(PLAN_CODES.map(async (code): Promise<SubscriptionPlan> => {
      const template = PLAN_TEMPLATES[code];
      const configuredPriceId = readString(env[PLAN_PRICE_ENV_KEYS[code]]);

      if (mode === 'mock') {
        return {
          code,
          name: template.name,
          description: template.description,
          maxActiveListings: template.maxActiveListings,
          currency: template.defaultCurrency,
          monthlyPriceMinor: template.defaultMonthlyPriceMinor,
          billingInterval: 'month',
          stripePriceId: configuredPriceId,
          available: true,
          unavailableReason: null,
        };
      }

      if (!configuredPriceId) {
        return {
          code,
          name: template.name,
          description: template.description,
          maxActiveListings: template.maxActiveListings,
          currency: template.defaultCurrency,
          monthlyPriceMinor: template.defaultMonthlyPriceMinor,
          billingInterval: 'month',
          stripePriceId: null,
          available: false,
          unavailableReason: `Le prix Stripe du plan ${template.name} n'est pas configuré.`,
        };
      }

      if (!this.stripe) {
        return {
          code,
          name: template.name,
          description: template.description,
          maxActiveListings: template.maxActiveListings,
          currency: template.defaultCurrency,
          monthlyPriceMinor: template.defaultMonthlyPriceMinor,
          billingInterval: 'month',
          stripePriceId: configuredPriceId,
          available: true,
          unavailableReason: null,
        };
      }

      try {
        const price = await this.stripe.prices.retrieve(configuredPriceId);
        const unitAmount = typeof price.unit_amount === 'number' && Number.isFinite(price.unit_amount)
          ? Math.max(0, Math.trunc(price.unit_amount))
          : template.defaultMonthlyPriceMinor;

        return {
          code,
          name: template.name,
          description: template.description,
          maxActiveListings: template.maxActiveListings,
          currency: (price.currency || template.defaultCurrency).toLowerCase(),
          monthlyPriceMinor: unitAmount,
          billingInterval: price.recurring?.interval ?? 'month',
          stripePriceId: configuredPriceId,
          available: price.active,
          unavailableReason: price.active ? null : `Le prix Stripe du plan ${template.name} est inactif.`,
        };
      } catch {
        return {
          code,
          name: template.name,
          description: template.description,
          maxActiveListings: template.maxActiveListings,
          currency: template.defaultCurrency,
          monthlyPriceMinor: template.defaultMonthlyPriceMinor,
          billingInterval: 'month',
          stripePriceId: configuredPriceId,
          available: false,
          unavailableReason: `Impossible de récupérer le prix Stripe du plan ${template.name}.`,
        };
      }
    }));

    return plans;
  }

  async listSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return this.resolvePlanCatalog();
  }

  async getMySubscriptionState(auth: RequestAuth | null, options?: { sync?: boolean }): Promise<MySubscriptionStateResult | null> {
    let user = await upsertUserFromAuth(this.prisma, auth);
    if (!user) return null;

    const plans = await this.resolvePlanCatalog();
    const shouldSync = Boolean(options?.sync);

    if (shouldSync && this.stripe) {
      const billing = this.readBillingSnapshot(user);
      if (billing.customerId) {
        const liveSubscription = await this.getCurrentStripeSubscription({
          customerId: billing.customerId,
          subscriptionId: billing.subscriptionId,
        });

        if (liveSubscription) {
          const snapshot = this.serializeStripeSubscription(liveSubscription, plans, billing.planCode);
          user = await this.updateUserStripeState({
            user,
            billingPatch: snapshot,
          });
        }
      }
    }

    const currentBilling = this.readBillingSnapshot(user);
    const currentPlan = plans.find((plan) => plan.code === currentBilling.planCode) ?? null;

    return {
      mode: this.getExecutionMode(),
      plans,
      currentPlanCode: currentBilling.planCode,
      currentPlan,
      subscription: this.toPublicBillingSnapshot(currentBilling),
      connect: {
        accountId: user.stripeConnectAccountId,
        onboardingStatus: this.readConnectOnboardingStatus(user),
      },
    };
  }

  async activateSubscription(input: ActivateSubscriptionInput, auth: RequestAuth | null): Promise<SubscriptionActivationResult | null> {
    const mode = this.getExecutionMode();
    const plans = await this.resolvePlanCatalog();
    const selectedPlan = plans.find((plan) => plan.code === input.planCode) ?? null;

    let user = await upsertUserFromAuth(this.prisma, auth);
    if (!user) return null;

    const connectState = await this.ensureStripeConnectAccount(user);
    user = connectState.user;

    if (!selectedPlan || !selectedPlan.available) {
      return {
        state: 'plan_unavailable',
        mode,
        plan: selectedPlan,
        subscription: this.toPublicBillingSnapshot(this.readBillingSnapshot(user)),
        connect: {
          accountId: connectState.accountId,
          onboardingStatus: this.readConnectOnboardingStatus(user),
          createdInFlow: connectState.created,
        },
        checkout: null,
        message: selectedPlan?.unavailableReason ?? 'Plan indisponible.',
      };
    }

    const ensuredCustomer = await this.ensureStripeCustomer(user);
    user = ensuredCustomer.user;

    const currentBilling = this.readBillingSnapshot(user);

    if (mode === 'mock') {
      if (isSubscriptionOngoing(currentBilling.status)) {
        const nextStatus = 'active';
        const isSamePlan = currentBilling.planCode === selectedPlan.code;

        const next = await this.updateUserStripeState({
          user,
          billingPatch: {
            subscriptionId: currentBilling.subscriptionId ?? generateMockId('sub_mock_'),
            planCode: selectedPlan.code,
            status: nextStatus,
            currentPeriodEndISO: oneMonthFromNowIso(),
            cancelAtPeriodEnd: false,
            updatedAtISO: nowIso(),
            pendingPlanCode: null,
            pendingCheckoutSessionId: null,
          },
        });

        return {
          state: isSamePlan ? 'already_active' : 'updated',
          mode,
          plan: selectedPlan,
          subscription: this.toPublicBillingSnapshot(this.readBillingSnapshot(next)),
          connect: {
            accountId: connectState.accountId,
            onboardingStatus: this.readConnectOnboardingStatus(next),
            createdInFlow: connectState.created,
          },
          checkout: null,
          message: isSamePlan
            ? 'Ce plan est déjà actif sur votre compte.'
            : `Votre plan a été mis à jour vers ${selectedPlan.name}.`,
        };
      }

      const sessionId = generateMockId('cs_mock_');
      const checkoutUrl = addQueryParam(input.successUrl, 'session_id', sessionId);

      const next = await this.updateUserStripeState({
        user,
        billingPatch: {
          pendingPlanCode: selectedPlan.code,
          pendingCheckoutSessionId: sessionId,
          updatedAtISO: nowIso(),
        },
      });

      return {
        state: 'checkout_required',
        mode,
        plan: selectedPlan,
        subscription: this.toPublicBillingSnapshot(this.readBillingSnapshot(next)),
        connect: {
          accountId: connectState.accountId,
          onboardingStatus: this.readConnectOnboardingStatus(next),
          createdInFlow: connectState.created,
        },
        checkout: {
          sessionId,
          url: checkoutUrl,
        },
        message: null,
      };
    }

    if (!this.stripe) {
      throw new Error('Stripe client unavailable while mode is live.');
    }

    const liveSubscription = await this.getCurrentStripeSubscription({
      customerId: ensuredCustomer.customerId,
      subscriptionId: currentBilling.subscriptionId,
    });

    if (liveSubscription) {
      const currentPriceId = liveSubscription.items.data[0]?.price?.id ?? null;
      const isAlreadyOnPlan = currentPriceId === selectedPlan.stripePriceId;

      if (isAlreadyOnPlan) {
        const snapshot = this.serializeStripeSubscription(liveSubscription, plans, selectedPlan.code);
        const next = await this.updateUserStripeState({
          user,
          billingPatch: snapshot,
        });

        return {
          state: 'already_active',
          mode,
          plan: selectedPlan,
          subscription: this.toPublicBillingSnapshot(this.readBillingSnapshot(next)),
          connect: {
            accountId: connectState.accountId,
            onboardingStatus: this.readConnectOnboardingStatus(next),
            createdInFlow: connectState.created,
          },
          checkout: null,
          message: 'Ce plan est déjà actif sur votre compte.',
        };
      }

      const subscriptionItemId = liveSubscription.items.data[0]?.id;
      if (!subscriptionItemId || !selectedPlan.stripePriceId) {
        throw new Error('Unable to update subscription: missing subscription item or price id.');
      }

      const updatedSubscription = await this.stripe.subscriptions.update(liveSubscription.id, {
        items: [{
          id: subscriptionItemId,
          price: selectedPlan.stripePriceId,
        }],
        proration_behavior: 'create_prorations',
        metadata: {
          userId: user.id,
          clerkUserId: user.clerkUserId ?? '',
          planCode: selectedPlan.code,
        },
      });

      const snapshot = this.serializeStripeSubscription(updatedSubscription, plans, selectedPlan.code);
      const next = await this.updateUserStripeState({
        user,
        billingPatch: snapshot,
      });

      return {
        state: 'updated',
        mode,
        plan: selectedPlan,
        subscription: this.toPublicBillingSnapshot(this.readBillingSnapshot(next)),
        connect: {
          accountId: connectState.accountId,
          onboardingStatus: this.readConnectOnboardingStatus(next),
          createdInFlow: connectState.created,
        },
        checkout: null,
        message: `Votre plan a été mis à jour vers ${selectedPlan.name}.`,
      };
    }

    if (!selectedPlan.stripePriceId) {
      return {
        state: 'plan_unavailable',
        mode,
        plan: selectedPlan,
        subscription: this.toPublicBillingSnapshot(currentBilling),
        connect: {
          accountId: connectState.accountId,
          onboardingStatus: this.readConnectOnboardingStatus(user),
          createdInFlow: connectState.created,
        },
        checkout: null,
        message: `Le prix Stripe du plan ${selectedPlan.name} n'est pas configuré.`,
      };
    }

    const successUrl = addQueryParam(input.successUrl, 'session_id', '{CHECKOUT_SESSION_ID}');

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: ensuredCustomer.customerId,
      client_reference_id: user.id,
      success_url: successUrl,
      cancel_url: input.cancelUrl,
      line_items: [
        {
          price: selectedPlan.stripePriceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      metadata: {
        userId: user.id,
        clerkUserId: user.clerkUserId ?? '',
        planCode: selectedPlan.code,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          clerkUserId: user.clerkUserId ?? '',
          planCode: selectedPlan.code,
        },
      },
    });

    if (!session.url) {
      throw new Error('Stripe checkout session URL is missing.');
    }

    const next = await this.updateUserStripeState({
      user,
      billingPatch: {
        pendingPlanCode: selectedPlan.code,
        pendingCheckoutSessionId: session.id,
        updatedAtISO: nowIso(),
      },
    });

    return {
      state: 'checkout_required',
      mode,
      plan: selectedPlan,
      subscription: this.toPublicBillingSnapshot(this.readBillingSnapshot(next)),
      connect: {
        accountId: connectState.accountId,
        onboardingStatus: this.readConnectOnboardingStatus(next),
        createdInFlow: connectState.created,
      },
      checkout: {
        sessionId: session.id,
        url: session.url,
      },
      message: null,
    };
  }

  async confirmSubscriptionCheckout(input: ConfirmCheckoutInput, auth: RequestAuth | null): Promise<ConfirmSubscriptionCheckoutResult | null> {
    let user = await upsertUserFromAuth(this.prisma, auth);
    if (!user) return null;

    const plans = await this.resolvePlanCatalog();
    const mode = this.getExecutionMode();
    const connectAccountId = user.stripeConnectAccountId;
    const connectStatus = this.readConnectOnboardingStatus(user);

    if (mode === 'mock') {
      const billing = this.readBillingSnapshot(user);
      const planCode = input.planCode ?? billing.pendingPlanCode ?? billing.planCode;
      if (!planCode) {
        return {
          state: 'not_found',
          mode,
          plan: null,
          subscription: this.toPublicBillingSnapshot(billing),
          connect: {
            accountId: connectAccountId,
            onboardingStatus: connectStatus,
            createdInFlow: false,
          },
          message: 'Aucun plan à confirmer pour cette session.',
        };
      }

      const next = await this.updateUserStripeState({
        user,
        billingPatch: {
          subscriptionId: billing.subscriptionId ?? generateMockId('sub_mock_'),
          planCode,
          status: 'active',
          currentPeriodEndISO: oneMonthFromNowIso(),
          cancelAtPeriodEnd: false,
          updatedAtISO: nowIso(),
          pendingPlanCode: null,
          pendingCheckoutSessionId: null,
        },
      });

      const nextBilling = this.readBillingSnapshot(next);
      const currentPlan = plans.find((plan) => plan.code === nextBilling.planCode) ?? null;

      return {
        state: 'confirmed',
        mode,
        plan: currentPlan,
        subscription: this.toPublicBillingSnapshot(nextBilling),
        connect: {
          accountId: next.stripeConnectAccountId,
          onboardingStatus: this.readConnectOnboardingStatus(next),
          createdInFlow: false,
        },
        message: null,
      };
    }

    if (!this.stripe) {
      throw new Error('Stripe client unavailable while mode is live.');
    }

    const session = await this.stripe.checkout.sessions.retrieve(input.sessionId, {
      expand: ['subscription'],
    });

    const billing = this.readBillingSnapshot(user);
    const sessionCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;

    if (billing.customerId && sessionCustomerId && billing.customerId !== sessionCustomerId) {
      return {
        state: 'not_found',
        mode,
        plan: null,
        subscription: this.toPublicBillingSnapshot(billing),
        connect: {
          accountId: connectAccountId,
          onboardingStatus: connectStatus,
          createdInFlow: false,
        },
        message: 'Cette session checkout ne correspond pas à l’utilisateur authentifié.',
      };
    }

    let subscription: Stripe.Subscription | null = null;
    if (typeof session.subscription === 'string') {
      subscription = await this.stripe.subscriptions.retrieve(session.subscription);
    } else if (session.subscription && typeof session.subscription === 'object') {
      subscription = session.subscription as Stripe.Subscription;
    }

    if (!subscription) {
      return {
        state: 'not_found',
        mode,
        plan: null,
        subscription: this.toPublicBillingSnapshot(billing),
        connect: {
          accountId: connectAccountId,
          onboardingStatus: connectStatus,
          createdInFlow: false,
        },
        message: 'La session Stripe ne contient aucun abonnement confirmé.',
      };
    }

    const snapshot = this.serializeStripeSubscription(subscription, plans, input.planCode ?? billing.pendingPlanCode);
    snapshot.customerId = sessionCustomerId ?? snapshot.customerId;

    user = await this.updateUserStripeState({
      user,
      billingPatch: snapshot,
    });

    const nextBilling = this.readBillingSnapshot(user);
    const currentPlan = plans.find((plan) => plan.code === nextBilling.planCode) ?? null;

    return {
      state: 'confirmed',
      mode,
      plan: currentPlan,
      subscription: this.toPublicBillingSnapshot(nextBilling),
      connect: {
        accountId: user.stripeConnectAccountId,
        onboardingStatus: this.readConnectOnboardingStatus(user),
        createdInFlow: false,
      },
      message: null,
    };
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
    let user = await upsertUserFromAuth(this.prisma, auth);
    if (!user) return null;

    const connect = await this.ensureStripeConnectAccount(user, {
      country: input.country,
      forcedAccountId: input.accountId,
    });
    user = connect.user;

    if (!this.stripe) {
      const fakeUrl = `${input.returnUrl}?account=${connect.accountId}&mode=mock`;

      user = await this.updateUserStripeState({
        user,
        connectPatch: {
          onboardingStatus: 'pending',
        },
      });

      return {
        accountId: connect.accountId,
        url: fakeUrl,
        mode: 'mock',
      };
    }

    const accountLink = await this.stripe.accountLinks.create({
      account: connect.accountId,
      refresh_url: input.refreshUrl,
      return_url: input.returnUrl,
      type: 'account_onboarding',
    });

    await this.updateUserStripeState({
      user,
      connectPatch: {
        onboardingStatus: 'pending',
      },
    });

    return {
      accountId: connect.accountId,
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
