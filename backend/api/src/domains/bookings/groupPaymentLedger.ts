// Paiement à plusieurs : les parts et leurs paiements Stripe. Ce module ne connaît que les tables
// `GroupPayment` / `GroupPaymentShare` / `Payment` et Stripe ; ce qui touche à la réservation
// (dates, e-mails, copie JSON) est décidé par `BookingsService` et `GroupBookingsService`.
//
// Chaque part est une empreinte sur la carte : PaymentIntent en capture manuelle, créé sur le compte
// de l'hôte (paiement direct, comme les autres réservations). Rien n'est débité tant que le groupe
// n'est pas complet ; les parts sont alors débitées ensemble. Si le groupe n'aboutit pas, les
// empreintes sont levées (aucun débit, donc aucun frais Stripe pour l'hôte). Une autorisation tient
// 7 jours chez Stripe, le groupe en a 3.

import { randomUUID } from 'node:crypto';

import type { GroupPayment, GroupPaymentShare, Prisma, PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

import { env } from '../../config/env.js';
import { toPrismaJson } from '../../lib/prisma.js';
import { allocateGroupRefund, resolveGroupPaymentExpiry, splitGroupAmount } from './groupPaymentRules.js';

type DbClient = Prisma.TransactionClient;

export type GroupWithShares = GroupPayment & { shares: GroupPaymentShare[] };

export type GroupPaymentStatus = 'pending' | 'capturing' | 'completed' | 'releasing' | 'expired' | 'canceled';
export type GroupCloseReason = 'expired' | 'organizer' | 'host';

/** Sous-ensemble du client Stripe utilisé ici : un faux client suffit aux contrôles. */
export type GroupStripeClient = {
  paymentIntents: Pick<Stripe['paymentIntents'], 'create' | 'retrieve' | 'capture' | 'cancel'>;
  refunds: Pick<Stripe['refunds'], 'create'>;
};

export type GroupShareIntent = {
  paymentIntentId: string;
  clientSecret: string;
  connectedAccountId: string | null;
  amountMinor: number;
  currency: string;
  /** Aucune clé Stripe (développement) : paiement simulé, rien n'est demandé à Stripe. */
  mock: boolean;
};

export type GroupCaptureOutcome = {
  captured: number;
  /** Parts dont le débit a échoué sans que l'autorisation soit perdue : à retenter. */
  retry: string[];
  /** Parts dont l'autorisation a disparu : remises « à régler ». */
  lost: GroupPaymentShare[];
};

export type GroupReleaseOutcome = {
  releasedMinor: number;
  refundedMinor: number;
  failures: Array<{ shareId: string; message: string }>;
};

export type GroupRefundOutcome = {
  refundedMinor: number;
  refundIds: string[];
  failures: Array<{ shareId: string; message: string }>;
};

const STRIPE_API_VERSION = '2025-02-24.acacia';
// PaymentIntent pas encore confirmé : le même peut resservir si l'ami rouvre la page.
const REUSABLE_INTENT_STATUSES = new Set(['requires_payment_method', 'requires_confirmation', 'requires_action']);
const PAID_SHARE_STATUSES = new Set(['authorized', 'captured']);

export function groupPaymentError(message: string, statusCode: number, code: string, details?: Record<string, unknown>): Error {
  const error = new Error(message) as Error & { statusCode: number; code: string; details?: Record<string, unknown> };
  error.statusCode = statusCode;
  error.code = code;
  if (details) error.details = details;
  return error;
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? 'Erreur inconnue.');
}

export function isGroupFullyPaid(group: GroupWithShares): boolean {
  return group.shares.length > 0 && group.shares.every((share) => PAID_SHARE_STATUSES.has(share.status));
}

export class GroupPaymentLedger {
  private readonly stripe: GroupStripeClient | null;

  constructor(
    private readonly prisma: PrismaClient,
    options?: { stripe?: GroupStripeClient | null },
  ) {
    this.stripe = options && 'stripe' in options
      ? options.stripe ?? null
      : env.STRIPE_SECRET_KEY
        ? new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION })
        : null;
  }

  /** Sans clé Stripe, les paiements sont simulés : jamais en production. */
  isMock(): boolean {
    return !this.stripe;
  }

  private assertUsable(): void {
    if (!this.stripe && env.NODE_ENV === 'production') {
      throw groupPaymentError('Le paiement en ligne est indisponible pour le moment.', 503, 'GROUP_PAYMENT_UNAVAILABLE');
    }
  }

  private stripeOptions(group: { stripeConnectedAccountId: string | null }, idempotencyKey?: string): Stripe.RequestOptions | undefined {
    const options: Stripe.RequestOptions = {};
    if (group.stripeConnectedAccountId) options.stripeAccount = group.stripeConnectedAccountId;
    if (idempotencyKey) options.idempotencyKey = idempotencyKey;
    return Object.keys(options).length ? options : undefined;
  }

  private computeApplicationFee(amountMinor: number): number {
    if (amountMinor <= 0 || env.STRIPE_CONNECT_PLATFORM_FEE_BPS <= 0) return 0;
    return Math.max(0, Math.round((amountMinor * env.STRIPE_CONNECT_PLATFORM_FEE_BPS) / 10000));
  }

  // --- Lecture -------------------------------------------------------------------------------

  async findById(groupId: string): Promise<GroupWithShares | null> {
    return this.prisma.groupPayment.findUnique({
      where: { id: groupId },
      include: { shares: { orderBy: { position: 'asc' } } },
    });
  }

  async findByReservationId(reservationId: string): Promise<GroupWithShares | null> {
    return this.prisma.groupPayment.findUnique({
      where: { reservationId },
      include: { shares: { orderBy: { position: 'asc' } } },
    });
  }

  async findByShareId(shareId: string): Promise<{ group: GroupWithShares; share: GroupPaymentShare } | null> {
    const share = await this.prisma.groupPaymentShare.findUnique({ where: { id: shareId } });
    if (!share) return null;
    const group = await this.findById(share.groupPaymentId);
    const fresh = group?.shares.find((item) => item.id === share.id);
    return group && fresh ? { group, share: fresh } : null;
  }

  // --- Création ------------------------------------------------------------------------------

  /**
   * Crée le groupe d'une réservation qui vient d'être écrite, dans la même transaction. La part de
   * l'organisateur est déjà autorisée : c'est le PaymentIntent vérifié par `verifyReservationPayment`.
   */
  async createGroup(tx: DbClient, input: {
    groupId: string;
    reservationId: string;
    listingId: string;
    organizer: { name: string | null; email: string | null };
    organizerPaymentIntentId: string;
    payersCount: number;
    totalAmountMinor: number;
    currency: string;
    connectedAccountId: string | null;
    publicBaseUrl: string | null;
    createdAt: Date;
  }): Promise<{ groupId: string; organizerShareId: string; expiresAt: Date }> {
    const amounts = splitGroupAmount(input.totalAmountMinor, input.payersCount);
    const organizerPayment = await tx.payment.findUnique({
      where: { stripePaymentIntentId: input.organizerPaymentIntentId },
      select: { id: true },
    });
    const expiresAt = resolveGroupPaymentExpiry(input.createdAt);

    await tx.groupPayment.create({
      data: {
        id: input.groupId,
        reservationId: input.reservationId,
        listingId: input.listingId,
        status: 'pending',
        currency: input.currency,
        totalAmountMinor: input.totalAmountMinor,
        payersCount: input.payersCount,
        stripeConnectedAccountId: input.connectedAccountId,
        publicBaseUrl: input.publicBaseUrl,
        expiresAt,
        createdAt: input.createdAt,
      },
    });

    const organizerShare = await tx.groupPaymentShare.create({
      data: {
        groupPaymentId: input.groupId,
        position: 0,
        email: input.organizer.email,
        name: input.organizer.name,
        amountMinor: amounts[0] ?? 0,
        status: 'authorized',
        paymentId: organizerPayment?.id ?? null,
        stripePaymentIntentId: input.organizerPaymentIntentId,
        authorizedAt: input.createdAt,
      },
      select: { id: true },
    });

    await tx.groupPaymentShare.createMany({
      data: amounts.slice(1).map((amountMinor, index) => ({
        groupPaymentId: input.groupId,
        position: index + 1,
        amountMinor,
        status: 'pending',
      })),
    });

    return { groupId: input.groupId, organizerShareId: organizerShare.id, expiresAt };
  }

  // --- Règlement d'une part --------------------------------------------------------------------

  /** PaymentIntent de la part d'un ami : le sien s'il en a déjà un en cours, un nouveau sinon. */
  async ensureShareIntent(input: {
    group: GroupWithShares;
    share: GroupPaymentShare;
    payerName: string | null;
    ownerId: string | null;
    stay: { startISO: string; endISO: string };
    now?: Date;
  }): Promise<GroupShareIntent> {
    const { group, share } = input;
    const now = input.now ?? new Date();
    this.assertUsable();

    if (group.status !== 'pending') {
      throw groupPaymentError('Ce paiement à plusieurs est clos.', 409, 'GROUP_PAYMENT_CLOSED');
    }
    if (now.getTime() >= group.expiresAt.getTime()) {
      throw groupPaymentError('Le délai pour régler votre part est dépassé.', 409, 'GROUP_PAYMENT_EXPIRED');
    }
    if (share.status !== 'pending') {
      throw groupPaymentError('Cette part est déjà réglée.', 409, 'GROUP_SHARE_ALREADY_PAID');
    }

    const payerName = input.payerName?.trim().slice(0, 120) || null;
    const metadata: Record<string, string> = {
      listingId: group.listingId,
      reservationId: group.reservationId,
      connectedAccountId: group.stripeConnectedAccountId ?? '',
      paymentChoice: 'group_share',
      groupPaymentId: group.id,
      groupShareId: share.id,
      groupSharePosition: String(share.position),
      groupPayers: String(group.payersCount),
      reservationStartISO: input.stay.startISO,
      reservationEndISO: input.stay.endISO,
    };

    if (!this.stripe) {
      const existing = share.stripePaymentIntentId?.startsWith('pi_mock_') ? share.stripePaymentIntentId : null;
      const id = existing ?? `pi_mock_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
      if (!existing) {
        await this.attachIntentToShare({ group, share, intentId: id, status: 'requires_payment_method', metadata, ownerId: input.ownerId, payerName, raw: { mode: 'mock' } });
      } else if (payerName && payerName !== share.name) {
        await this.prisma.groupPaymentShare.update({ where: { id: share.id }, data: { name: payerName } });
      }
      return {
        paymentIntentId: id,
        clientSecret: `${id}_secret_mock`,
        connectedAccountId: group.stripeConnectedAccountId,
        amountMinor: share.amountMinor,
        currency: group.currency,
        mock: true,
      };
    }

    if (share.stripePaymentIntentId) {
      const current = await this.stripe.paymentIntents.retrieve(share.stripePaymentIntentId, {}, this.stripeOptions(group));
      if (current.status === 'requires_capture' || current.status === 'succeeded' || current.status === 'processing') {
        throw groupPaymentError('Cette part est déjà réglée.', 409, 'GROUP_SHARE_ALREADY_PAID');
      }
      if (REUSABLE_INTENT_STATUSES.has(current.status) && current.amount === share.amountMinor && current.client_secret) {
        if (payerName && payerName !== share.name) {
          await this.prisma.groupPaymentShare.update({ where: { id: share.id }, data: { name: payerName } });
        }
        return {
          paymentIntentId: current.id,
          clientSecret: current.client_secret,
          connectedAccountId: group.stripeConnectedAccountId,
          amountMinor: share.amountMinor,
          currency: group.currency,
          mock: false,
        };
      }
    }

    const applicationFee = this.computeApplicationFee(share.amountMinor);
    const intent = await this.stripe.paymentIntents.create({
      amount: share.amountMinor,
      currency: group.currency,
      // Empreinte : la carte est autorisée, le débit n'a lieu que si tout le groupe a réglé. Seules les
      // cartes (et les portefeuilles qui en portent une) savent autoriser sans débiter.
      capture_method: 'manual',
      payment_method_types: ['card'],
      description: `Paiement à plusieurs, part ${share.position + 1} sur ${group.payersCount}`,
      metadata,
      ...(applicationFee > 0 ? { application_fee_amount: applicationFee } : {}),
    }, this.stripeOptions(group));

    if (!intent.client_secret) {
      throw new Error('Stripe did not return a client_secret.');
    }

    await this.attachIntentToShare({
      group,
      share,
      intentId: intent.id,
      status: intent.status,
      metadata,
      ownerId: input.ownerId,
      payerName,
      raw: intent as unknown as Record<string, unknown>,
    });

    return {
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      connectedAccountId: group.stripeConnectedAccountId,
      amountMinor: share.amountMinor,
      currency: intent.currency,
      mock: false,
    };
  }

  private async attachIntentToShare(input: {
    group: GroupWithShares;
    share: GroupPaymentShare;
    intentId: string;
    status: string;
    metadata: Record<string, string>;
    ownerId: string | null;
    payerName: string | null;
    raw: Record<string, unknown>;
  }): Promise<void> {
    const { group, share } = input;
    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          listingId: group.listingId,
          reservationId: group.reservationId,
          userId: input.ownerId,
          stripePaymentIntentId: input.intentId,
          stripeConnectedAccountId: group.stripeConnectedAccountId,
          currency: group.currency,
          amountMinor: share.amountMinor,
          status: input.status,
          paymentChoice: 'group_share',
          chargeNowAmountMinor: share.amountMinor,
          deferredAmountMinor: 0,
          deferredMode: 'none',
          metadata: toPrismaJson(input.metadata),
          rawResponse: toPrismaJson(input.raw),
        },
        select: { id: true },
      });
      await tx.groupPaymentShare.update({
        where: { id: share.id },
        data: {
          paymentId: payment.id,
          stripePaymentIntentId: input.intentId,
          ...(input.payerName ? { name: input.payerName } : {}),
        },
      });
    });
  }

  private async markShareAuthorized(share: GroupPaymentShare, now: Date): Promise<boolean> {
    const updated = await this.prisma.groupPaymentShare.updateMany({
      where: { id: share.id, status: 'pending' },
      data: { status: 'authorized', authorizedAt: now },
    });
    if (share.paymentId) {
      await this.prisma.payment.update({ where: { id: share.paymentId }, data: { status: 'requires_capture' } });
    }
    return updated.count === 1;
  }

  private async markShareReleased(share: GroupPaymentShare, paymentStatus = 'canceled'): Promise<void> {
    await this.prisma.groupPaymentShare.update({ where: { id: share.id }, data: { status: 'released' } });
    if (share.paymentId) {
      await this.prisma.payment.update({ where: { id: share.paymentId }, data: { status: paymentStatus } });
    }
  }

  /**
   * Relit chez Stripe une part pas encore notée comme réglée (le navigateur a pu se fermer après la
   * validation de la banque). Renvoie `true` si la part vient d'être autorisée.
   * `assumeAuthorized` : paiement simulé (aucune clé Stripe), où le site annonce lui-même le règlement.
   */
  async refreshShare(group: GroupWithShares, share: GroupPaymentShare, options?: { assumeAuthorized?: boolean; now?: Date }): Promise<boolean> {
    if (share.status !== 'pending' || !share.stripePaymentIntentId) return false;
    const now = options?.now ?? new Date();
    const open = group.status === 'pending' || group.status === 'capturing';

    if (!this.stripe) {
      if (!options?.assumeAuthorized || env.NODE_ENV === 'production' || !open) return false;
      return this.markShareAuthorized(share, now);
    }

    const intent = await this.stripe.paymentIntents.retrieve(share.stripePaymentIntentId, {}, this.stripeOptions(group));
    if (intent.amount !== share.amountMinor || intent.currency !== group.currency) {
      console.error('[group-payments] payment intent does not match its share', { groupId: group.id, shareId: share.id });
      return false;
    }

    if (intent.status === 'requires_capture') {
      if (open) return this.markShareAuthorized(share, now);
      // Groupe déjà clos quand la banque a validé : l'empreinte est levée tout de suite.
      await this.stripe.paymentIntents.cancel(share.stripePaymentIntentId, { cancellation_reason: 'abandoned' }, this.stripeOptions(group));
      await this.markShareReleased(share);
      return false;
    }

    if (share.paymentId) {
      await this.prisma.payment.updateMany({
        where: { id: share.paymentId, status: { not: intent.status } },
        data: { status: intent.status },
      });
    }
    return false;
  }

  // --- États du groupe -------------------------------------------------------------------------

  /** Passage d'état conditionnel : un seul traitement l'obtient, même à deux en même temps. */
  async claim(groupId: string, from: GroupPaymentStatus[], to: GroupPaymentStatus, data?: Prisma.GroupPaymentUpdateManyMutationInput): Promise<boolean> {
    const result = await this.prisma.groupPayment.updateMany({
      where: { id: groupId, status: { in: from } },
      data: { status: to, ...data },
    });
    return result.count === 1;
  }

  /** Reprise d'un traitement resté en cours (arrêt de l'API pendant un débit ou une levée). */
  async touchProcessing(groupId: string, now = new Date()): Promise<void> {
    await this.prisma.groupPayment.update({ where: { id: groupId }, data: { processingAt: now } });
  }

  // --- Débit, levée, remboursement -------------------------------------------------------------

  /** Débite toutes les parts autorisées. Le groupe doit être en `capturing`. */
  async captureShares(group: GroupWithShares, now = new Date()): Promise<GroupCaptureOutcome> {
    const outcome: GroupCaptureOutcome = { captured: 0, retry: [], lost: [] };

    for (const share of group.shares) {
      if (share.status === 'captured') {
        outcome.captured += 1;
        continue;
      }
      if (share.status !== 'authorized' || !share.stripePaymentIntentId) continue;

      let intentStatus = 'succeeded';
      if (this.stripe) {
        const intentId = share.stripePaymentIntentId;
        try {
          const captured = await this.stripe.paymentIntents.capture(intentId, {}, this.stripeOptions(group, `gp-capture-${share.id}-${intentId}`));
          intentStatus = captured.status;
        } catch (error) {
          // Débit refusé : l'état réel du paiement décide (déjà débité, encore autorisé, ou perdu).
          try {
            intentStatus = (await this.stripe.paymentIntents.retrieve(intentId, {}, this.stripeOptions(group))).status;
          } catch {
            intentStatus = 'requires_capture';
          }
          console.warn('[group-payments] capture failed', { groupId: group.id, shareId: share.id, intentStatus, error: readErrorMessage(error) });
        }
      }

      if (intentStatus === 'succeeded') {
        await this.prisma.groupPaymentShare.update({ where: { id: share.id }, data: { status: 'captured', capturedAt: now } });
        if (share.paymentId) {
          await this.prisma.payment.update({ where: { id: share.paymentId }, data: { status: 'succeeded' } });
        }
        outcome.captured += 1;
      } else if (intentStatus === 'requires_capture' || intentStatus === 'processing') {
        outcome.retry.push(share.id);
      } else {
        // Autorisation expirée ou annulée par la banque : la part est de nouveau à régler.
        if (share.paymentId) {
          await this.prisma.payment.update({ where: { id: share.paymentId }, data: { status: intentStatus } });
        }
        const reset = await this.prisma.groupPaymentShare.update({
          where: { id: share.id },
          data: { status: 'pending', paymentId: null, stripePaymentIntentId: null, authorizedAt: null },
        });
        outcome.lost.push(reset);
      }
    }

    return outcome;
  }

  /**
   * Le groupe n'aboutit pas : empreintes levées, parts déjà débitées remboursées en entier. Chaque
   * part est traitée une fois ; un échec est renvoyé pour être retenté au passage suivant.
   */
  async releaseShares(group: GroupWithShares): Promise<GroupReleaseOutcome> {
    const outcome: GroupReleaseOutcome = { releasedMinor: 0, refundedMinor: 0, failures: [] };

    for (const share of group.shares) {
      const intentId = share.stripePaymentIntentId;
      try {
        if (share.status === 'authorized' || (share.status === 'pending' && intentId)) {
          const wasAuthorized = share.status === 'authorized';
          let refundInstead = false;
          if (this.stripe && intentId) {
            try {
              await this.stripe.paymentIntents.cancel(intentId, { cancellation_reason: 'abandoned' }, this.stripeOptions(group));
            } catch (error) {
              const current = await this.stripe.paymentIntents.retrieve(intentId, {}, this.stripeOptions(group));
              if (current.status === 'succeeded') refundInstead = true;
              else if (current.status !== 'canceled') throw error;
            }
          }
          if (refundInstead && this.stripe && intentId) {
            await this.refundShare(group, share, share.amountMinor, 'gp-release');
            outcome.refundedMinor += share.amountMinor;
          } else {
            await this.markShareReleased(share);
            if (wasAuthorized) outcome.releasedMinor += share.amountMinor;
          }
        } else if (share.status === 'captured') {
          await this.refundShare(group, share, share.amountMinor, 'gp-release');
          outcome.refundedMinor += share.amountMinor;
        }
      } catch (error) {
        console.error('[group-payments] release failed', { groupId: group.id, shareId: share.id, error: readErrorMessage(error) });
        outcome.failures.push({ shareId: share.id, message: readErrorMessage(error) });
      }
    }

    return outcome;
  }

  private async refundShare(group: GroupWithShares, share: GroupPaymentShare, amountMinor: number, keyPrefix: string): Promise<string | null> {
    let refundId: string | null = null;
    if (this.stripe && share.stripePaymentIntentId) {
      const applicationFee = this.computeApplicationFee(share.amountMinor);
      const refund = await this.stripe.refunds.create({
        payment_intent: share.stripePaymentIntentId,
        amount: amountMinor,
        reason: 'requested_by_customer',
        ...(applicationFee > 0 ? { refund_application_fee: true } : {}),
        metadata: { reservationId: group.reservationId, listingId: group.listingId, groupPaymentId: group.id, groupShareId: share.id },
      }, this.stripeOptions(group, `${keyPrefix}-${share.id}-${amountMinor}`));
      refundId = refund.id;
    }

    const full = amountMinor >= share.amountMinor;
    if (full) {
      await this.prisma.groupPaymentShare.update({ where: { id: share.id }, data: { status: 'refunded' } });
    }
    if (share.paymentId) {
      await this.prisma.payment.update({
        where: { id: share.paymentId },
        data: {
          status: full ? 'refunded' : 'partially_refunded',
          refundedAmountMinor: amountMinor,
          refundStatus: this.stripe ? 'pending' : 'succeeded',
          refundUpdatedAt: new Date(),
        },
      });
    }
    return refundId;
  }

  /**
   * Annulation d'une réservation confirmée : le remboursement décidé par le barème de l'hôte est
   * réparti sur les parts débitées, au prorata de chacune.
   */
  async refundCapturedShares(group: GroupWithShares, refundTotalMinor: number): Promise<GroupRefundOutcome> {
    const outcome: GroupRefundOutcome = { refundedMinor: 0, refundIds: [], failures: [] };
    // La répartition se fait toujours sur toutes les parts débitées, y compris celles qu'un premier
    // essai a déjà remboursées : un nouvel essai ne rembourse que les parts restantes.
    const charged = group.shares.filter((share) => share.status === 'captured' || share.status === 'refunded');
    const amounts = allocateGroupRefund(charged.map((share) => share.amountMinor), refundTotalMinor);
    const paymentIds = charged.map((share) => share.paymentId).filter((id): id is string => Boolean(id));
    const payments = paymentIds.length
      ? await this.prisma.payment.findMany({ where: { id: { in: paymentIds } }, select: { id: true, refundedAmountMinor: true } })
      : [];
    const alreadyRefunded = new Map(payments.map((payment) => [payment.id, payment.refundedAmountMinor ?? 0]));

    for (const [index, share] of charged.entries()) {
      const amount = amounts[index] ?? 0;
      if (amount <= 0) continue;
      const done = share.paymentId ? alreadyRefunded.get(share.paymentId) ?? 0 : 0;
      if (share.status === 'refunded' || done > 0) {
        outcome.refundedMinor += share.status === 'refunded' ? share.amountMinor : done;
        continue;
      }
      try {
        const refundId = await this.refundShare(group, share, amount, 'gp-cancel');
        if (refundId) outcome.refundIds.push(refundId);
        outcome.refundedMinor += amount;
      } catch (error) {
        console.error('[group-payments] refund failed', { groupId: group.id, shareId: share.id, error: readErrorMessage(error) });
        outcome.failures.push({ shareId: share.id, message: readErrorMessage(error) });
      }
    }

    return outcome;
  }
}

export function buildGroupPaymentId(): string {
  return randomUUID().replace(/-/g, '');
}
