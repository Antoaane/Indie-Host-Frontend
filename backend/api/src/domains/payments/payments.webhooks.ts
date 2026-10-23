import { Prisma } from '@prisma/client';
import type { Payment, PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import Stripe from 'stripe';

import { env } from '../../config/env.js';
import { asObject } from '../../lib/json.js';
import { toPrismaJson } from '../../lib/prisma.js';

// Même version d'API que PaymentsService : les objets reçus ont la forme attendue par le SDK.
const STRIPE_API_VERSION = '2025-02-24.acacia';

// Un événement Stripe tient en quelques Ko ; le parent accepte 50 Mo (vidéos), inutile ici.
const WEBHOOK_BODY_LIMIT_BYTES = 1024 * 1024;

// Statuts de PaymentIntent antérieurs au règlement : seuls ceux-là peuvent être écrasés par un
// événement payment_intent.* (jamais un statut posé par l'API après remboursement ou annulation).
const PRE_SETTLEMENT_PAYMENT_STATUSES = new Set([
  'requires_payment_method',
  'requires_confirmation',
  'requires_action',
  'processing',
  'requires_capture',
]);

const HANDLED_EVENT_TYPES = new Set<string>([
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'charge.refunded',
  'charge.refund.updated',
  'refund.updated',
  'refund.failed',
  'charge.dispute.created',
  'charge.dispute.updated',
  'charge.dispute.closed',
  'charge.dispute.funds_withdrawn',
  'charge.dispute.funds_reinstated',
]);

export type StripeWebhookOutcome = {
  handled: boolean;
  duplicate?: boolean;
  matched?: boolean;
};

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function readPaymentIntentId(value: string | Stripe.PaymentIntent | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

function eventDate(event: Stripe.Event): Date {
  return new Date(event.created * 1000);
}

// Traitement des événements Stripe retenus. Chaque handler est idempotent (il pose un état, il ne
// cumule rien), ce qui tolère une livraison concurrente du même événement.
export class StripeWebhookProcessor {
  constructor(private readonly prisma: PrismaClient) {}

  async process(event: Stripe.Event, log: FastifyBaseLogger): Promise<StripeWebhookOutcome> {
    if (!HANDLED_EVENT_TYPES.has(event.type)) {
      return { handled: false };
    }

    const seen = await this.prisma.stripeWebhookEvent.findUnique({
      where: { id: event.id },
      select: { id: true },
    });
    if (seen) {
      log.info({ eventId: event.id, eventType: event.type }, '[payments] Stripe webhook already processed, skipped');
      return { handled: true, duplicate: true };
    }

    const matched = await this.dispatch(event, log);

    // Marqué traité seulement après succès : en cas d'erreur, la réponse 500 fait réémettre
    // l'événement par Stripe et il sera retraité.
    try {
      await this.prisma.stripeWebhookEvent.create({
        data: { id: event.id, type: event.type },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }

    return { handled: true, matched };
  }

  private async dispatch(event: Stripe.Event, log: FastifyBaseLogger): Promise<boolean> {
    switch (event.type) {
      case 'payment_intent.succeeded':
      case 'payment_intent.payment_failed':
        return this.handlePaymentIntent(event, event.data.object as Stripe.PaymentIntent, log);
      case 'charge.refunded':
        return this.handleChargeRefunded(event, event.data.object as Stripe.Charge, log);
      case 'charge.refund.updated':
      case 'refund.updated':
      case 'refund.failed':
        return this.handleRefund(event, event.data.object as Stripe.Refund, log);
      case 'charge.dispute.created':
      case 'charge.dispute.updated':
      case 'charge.dispute.closed':
      case 'charge.dispute.funds_withdrawn':
      case 'charge.dispute.funds_reinstated':
        return this.handleDispute(event, event.data.object as Stripe.Dispute, log);
      default:
        return false;
    }
  }

  private async findPayment(
    paymentIntentId: string | null,
    event: Stripe.Event,
    log: FastifyBaseLogger,
    missingLevel: 'info' | 'warn',
  ): Promise<Payment | null> {
    const context = { eventId: event.id, eventType: event.type, paymentIntentId };

    if (!paymentIntentId) {
      log[missingLevel](context, '[payments] Stripe webhook without payment_intent, ignored');
      return null;
    }

    const payment = await this.prisma.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
    });

    if (!payment) {
      // Les PaymentIntents des abonnements SaaS passent aussi par ici : aucune ligne Payment n'existe pour eux.
      log[missingLevel](context, '[payments] Stripe webhook for an unknown PaymentIntent, ignored');
    }

    return payment;
  }

  private logContext(payment: Payment, event: Stripe.Event) {
    return {
      eventId: event.id,
      eventType: event.type,
      paymentId: payment.id,
      paymentIntentId: payment.stripePaymentIntentId,
      listingId: payment.listingId,
      reservationId: payment.reservationId,
    };
  }

  // Trace du dernier événement reçu, rangée dans rawResponse comme le fait déjà l'annulation
  // (bookingCancellation) : rien à migrer pour l'enrichir.
  private webhookTrail(payment: Payment, event: Stripe.Event, patch: Record<string, unknown>): Prisma.InputJsonValue {
    const raw = asObject(payment.rawResponse);
    const previous = asObject(raw.stripeWebhook);

    return toPrismaJson({
      ...raw,
      stripeWebhook: {
        ...previous,
        ...patch,
        lastEventId: event.id,
        lastEventType: event.type,
        lastEventAt: eventDate(event).toISOString(),
      },
    });
  }

  private async handlePaymentIntent(
    event: Stripe.Event,
    intent: Stripe.PaymentIntent,
    log: FastifyBaseLogger,
  ): Promise<boolean> {
    const payment = await this.findPayment(intent.id, event, log, 'info');
    if (!payment) return false;

    const context = this.logContext(payment, event);
    const canOverwriteStatus = PRE_SETTLEMENT_PAYMENT_STATUSES.has(payment.status) && intent.status !== payment.status;
    const failure = event.type === 'payment_intent.payment_failed'
      ? {
          code: intent.last_payment_error?.code ?? null,
          declineCode: intent.last_payment_error?.decline_code ?? null,
          message: intent.last_payment_error?.message ?? null,
        }
      : null;

    if (!canOverwriteStatus && !failure) {
      log.debug({ ...context, status: payment.status }, '[payments] Stripe payment_intent event without status change');
      return true;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        ...(canOverwriteStatus ? { status: intent.status } : {}),
        rawResponse: this.webhookTrail(payment, event, failure ? { lastPaymentFailure: failure } : {}),
      },
    });

    if (failure) {
      log.warn({ ...context, status: intent.status, failure }, '[payments] Stripe payment failed');
    } else {
      log.info({ ...context, previousStatus: payment.status, status: intent.status }, '[payments] Stripe payment status updated');
    }

    return true;
  }

  private async handleChargeRefunded(
    event: Stripe.Event,
    charge: Stripe.Charge,
    log: FastifyBaseLogger,
  ): Promise<boolean> {
    const payment = await this.findPayment(readPaymentIntentId(charge.payment_intent), event, log, 'warn');
    if (!payment) return false;

    const at = eventDate(event);
    if (payment.refundUpdatedAt && payment.refundUpdatedAt > at) {
      log.info(this.logContext(payment, event), '[payments] Stripe refund event older than the stored state, skipped');
      return true;
    }

    const refundedAmountMinor = Math.max(0, charge.amount_refunded ?? 0);
    const fullyRefunded = charge.refunded === true || refundedAmountMinor >= charge.amount;
    const nextStatus = refundedAmountMinor <= 0
      ? payment.status
      : fullyRefunded
        ? 'refunded'
        : 'partially_refunded';

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: nextStatus,
        // Le statut détaillé du remboursement (pending/succeeded/failed) est affiné par refund.updated.
        refundStatus: refundedAmountMinor > 0 ? 'succeeded' : payment.refundStatus,
        refundFailureReason: refundedAmountMinor > 0 ? null : payment.refundFailureReason,
        refundedAmountMinor,
        refundUpdatedAt: at,
        rawResponse: this.webhookTrail(payment, event, {
          chargeId: charge.id,
          refundedAmountMinor,
        }),
      },
    });

    log.info({
      ...this.logContext(payment, event),
      previousStatus: payment.status,
      status: nextStatus,
      refundedAmountMinor,
      chargeAmountMinor: charge.amount,
    }, '[payments] Stripe charge refunded');

    return true;
  }

  private async handleRefund(
    event: Stripe.Event,
    refund: Stripe.Refund,
    log: FastifyBaseLogger,
  ): Promise<boolean> {
    const payment = await this.findPayment(readPaymentIntentId(refund.payment_intent), event, log, 'warn');
    if (!payment) return false;

    const context = this.logContext(payment, event);
    const at = eventDate(event);
    if (payment.refundUpdatedAt && payment.refundUpdatedAt > at) {
      log.info(context, '[payments] Stripe refund event older than the stored state, skipped');
      return true;
    }

    const refundStatus = refund.status ?? 'unknown';
    const failed = refundStatus === 'failed';

    // Un remboursement échoué est repris par Stripe sur le montant remboursé de la charge :
    // on retranche son montant quand ce montant est connu, et le statut global suit.
    let refundedAmountMinor = payment.refundedAmountMinor;
    let status = payment.status;
    if (failed && refundedAmountMinor !== null) {
      refundedAmountMinor = Math.max(0, refundedAmountMinor - refund.amount);
      if (refundedAmountMinor === 0 && (status === 'refunded' || status === 'partially_refunded')) {
        status = 'succeeded';
      } else if (refundedAmountMinor > 0 && status === 'refunded') {
        status = 'partially_refunded';
      }
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status,
        refundStatus,
        refundFailureReason: failed ? (refund.failure_reason ?? 'unknown') : null,
        refundedAmountMinor,
        refundUpdatedAt: at,
        rawResponse: this.webhookTrail(payment, event, {
          lastRefundId: refund.id,
          lastRefundStatus: refundStatus,
          lastRefundAmountMinor: refund.amount,
          lastRefundFailureReason: failed ? (refund.failure_reason ?? 'unknown') : null,
        }),
      },
    });

    const details = {
      ...context,
      refundId: refund.id,
      refundStatus,
      refundAmountMinor: refund.amount,
      failureReason: refund.failure_reason ?? null,
    };

    if (failed) {
      // Niveau error : visible dans `docker compose logs api`, à traiter à la main (voyageur à rembourser autrement).
      log.error(details, '[payments] Stripe refund FAILED');
    } else {
      log.info(details, '[payments] Stripe refund updated');
    }

    return true;
  }

  private async handleDispute(
    event: Stripe.Event,
    dispute: Stripe.Dispute,
    log: FastifyBaseLogger,
  ): Promise<boolean> {
    const payment = await this.findPayment(readPaymentIntentId(dispute.payment_intent), event, log, 'warn');
    if (!payment) return false;

    const context = this.logContext(payment, event);
    const at = eventDate(event);
    if (payment.disputeId === dispute.id && payment.disputeUpdatedAt && payment.disputeUpdatedAt > at) {
      log.info(context, '[payments] Stripe dispute event older than the stored state, skipped');
      return true;
    }

    const fundsPatch = event.type === 'charge.dispute.funds_withdrawn'
      ? { disputeFunds: 'withdrawn' }
      : event.type === 'charge.dispute.funds_reinstated'
        ? { disputeFunds: 'reinstated' }
        : {};

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        disputeId: dispute.id,
        disputeStatus: dispute.status,
        disputeReason: dispute.reason,
        disputeAmountMinor: dispute.amount,
        disputeUpdatedAt: at,
        rawResponse: this.webhookTrail(payment, event, {
          ...fundsPatch,
          disputeEvidenceDueBy: dispute.evidence_details?.due_by
            ? new Date(dispute.evidence_details.due_by * 1000).toISOString()
            : null,
        }),
      },
    });

    log.warn({
      ...context,
      disputeId: dispute.id,
      disputeStatus: dispute.status,
      disputeReason: dispute.reason,
      disputeAmountMinor: dispute.amount,
      ...fundsPatch,
    }, '[payments] Stripe dispute update');

    return true;
  }
}

// Point d'entrée des webhooks Stripe : public (pas de JWT), authentifié par la signature Stripe.
// Plugin encapsulé (pas fastify-plugin) : le parseur « corps brut » ci-dessous ne s'applique qu'à
// cette route, la signature étant calculée sur les octets exacts reçus.
export async function stripeWebhooksPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
    done(null, body);
  });

  // Deux destinations Stripe peuvent viser cette URL : les événements du compte plateforme
  // (STRIPE_WEBHOOK_SECRET) et ceux des comptes connectés des hôtes, où vivent les paiements
  // directs (STRIPE_CONNECT_WEBHOOK_SECRET). Chacune signe avec son propre secret.
  const webhookSecrets = [env.STRIPE_WEBHOOK_SECRET, env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(Boolean);
  const stripe = env.STRIPE_SECRET_KEY && webhookSecrets.length
    ? new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION })
    : null;
  const processor = new StripeWebhookProcessor(fastify.prisma);

  if (!stripe) {
    fastify.log.warn(
      webhookSecrets.length
        ? '[payments] STRIPE_SECRET_KEY absent : POST /payments/stripe/webhook répondra 503 (remboursements échoués et litiges non suivis).'
        : '[payments] STRIPE_WEBHOOK_SECRET et STRIPE_CONNECT_WEBHOOK_SECRET absents : POST /payments/stripe/webhook répondra 503 (remboursements échoués et litiges non suivis).',
    );
  } else if (!env.STRIPE_CONNECT_WEBHOOK_SECRET) {
    fastify.log.warn('[payments] STRIPE_CONNECT_WEBHOOK_SECRET absent : les événements des comptes des hôtes (remboursements, litiges des paiements directs) seront refusés.');
  }

  fastify.post('/payments/stripe/webhook', {
    bodyLimit: WEBHOOK_BODY_LIMIT_BYTES,
  }, async (request, reply) => {
    if (!stripe) {
      reply.code(503).send({ message: 'Webhook Stripe non configuré.' });
      return;
    }

    const signature = request.headers['stripe-signature'];
    const rawBody = request.body;
    if (typeof signature !== 'string' || !signature || typeof rawBody !== 'string' || !rawBody) {
      reply.code(400).send({ message: 'Signature Stripe manquante.' });
      return;
    }

    let event: Stripe.Event | null = null;
    let lastError: unknown = null;
    for (const secret of webhookSecrets) {
      try {
        event = stripe.webhooks.constructEvent(rawBody, signature, secret);
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!event) {
      request.log.warn({ err: lastError }, '[payments] Stripe webhook signature rejected');
      reply.code(400).send({ message: 'Signature Stripe invalide.' });
      return;
    }

    // Traitement synchrone mais léger (une ou deux requêtes SQL) : Stripe attend la réponse sous 20 s
    // et réémet l'événement en cas de 5xx.
    const outcome = await processor.process(event, request.log);
    reply.send({ received: true, ...outcome });
  });
}
