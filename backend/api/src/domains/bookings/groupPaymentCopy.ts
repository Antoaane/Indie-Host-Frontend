// Copie de l'état d'un paiement à plusieurs dans le JSON `payment.group` d'une réservation (ligne
// `Reservation` et copie de l'annonce) : c'est ce que lisent l'écran Réservations et les e-mails.
// La vérité est dans les tables `GroupPayment` / `GroupPaymentShare` ; cette copie n'est écrite que
// par le serveur, et rétablie quand le site renvoie une version plus ancienne de ses réservations.

import type { Prisma } from '@prisma/client';

import { asObject } from '../../lib/json.js';

type DbClient = Prisma.TransactionClient;

/** État montré aux hôtes et aux voyageurs (les états de traitement internes n'y figurent pas). */
export type GroupPaymentPublicStatus = 'pending' | 'completed' | 'expired' | 'canceled';

export type GroupPaymentCopy = {
  id: string;
  status: GroupPaymentPublicStatus;
  /** Nombre de payeurs, organisateur compris. */
  payers: number;
  /** Parts réglées (empreinte posée ou part débitée). */
  paidCount: number;
  expiresAtISO: string;
  /** Montant réglé en ligne par le groupe, en centimes. */
  totalAmountMinor: number;
};

type GroupRow = {
  id: string;
  status: string;
  payersCount: number;
  totalAmountMinor: number;
  expiresAt: Date;
  closeReason?: string | null;
  shares: Array<{ status: string }>;
};

const PAID_SHARE_STATUSES = new Set(['authorized', 'captured']);

export function toGroupPaymentPublicStatus(group: { status: string; closeReason?: string | null }): GroupPaymentPublicStatus {
  if (group.status === 'completed') return 'completed';
  if (group.status === 'expired') return 'expired';
  if (group.status === 'canceled') return 'canceled';
  // Levée des empreintes en cours : l'issue est déjà décidée.
  if (group.status === 'releasing') return group.closeReason === 'expired' ? 'expired' : 'canceled';
  return 'pending';
}

export function toGroupPaymentCopy(group: GroupRow): GroupPaymentCopy {
  return {
    id: group.id,
    status: toGroupPaymentPublicStatus(group),
    payers: group.payersCount,
    paidCount: group.shares.filter((share) => PAID_SHARE_STATUSES.has(share.status)).length,
    expiresAtISO: group.expiresAt.toISOString(),
    totalAmountMinor: group.totalAmountMinor,
  };
}

export async function loadGroupPaymentCopies(db: DbClient, listingId: string): Promise<Map<string, GroupPaymentCopy>> {
  const groups = await db.groupPayment.findMany({
    where: { listingId },
    select: {
      id: true,
      reservationId: true,
      status: true,
      payersCount: true,
      totalAmountMinor: true,
      expiresAt: true,
      closeReason: true,
      shares: { select: { status: true } },
    },
  });
  return new Map(groups.map((group) => [group.reservationId, toGroupPaymentCopy(group)]));
}

/** Paiement d'une réservation avec l'état du groupe : tant qu'il n'est pas complet, rien n'est payé. */
export function applyGroupCopyToPayment(payment: Record<string, unknown>, copy: GroupPaymentCopy | null): Record<string, unknown> {
  if (!copy) {
    if (payment.group === undefined) return payment;
    const { group: _group, ...rest } = payment;
    return rest;
  }

  const stripe = asObject(payment.stripe);
  const deferred = Number(stripe.deferredAmount ?? payment.balance ?? 0) || 0;
  const completed = copy.status === 'completed';
  return {
    ...payment,
    status: completed && deferred <= 0 ? 'paid' : 'pending',
    stripe: {
      ...stripe,
      // État de la part de l'organisateur : autorisée, puis débitée avec les autres.
      status: completed ? 'succeeded' : copy.status === 'pending' ? 'requires_capture' : 'canceled',
    },
    group: copy,
  };
}

/**
 * Réservations d'une section `bookings` avec l'état de leur groupe tel que le serveur le connaît :
 * une copie renvoyée par le site ne peut ni l'inventer ni le figer.
 */
export function applyGroupPaymentCopies(
  bookings: Record<string, unknown>,
  copies: Map<string, GroupPaymentCopy>,
): Record<string, unknown> {
  if (!Array.isArray(bookings.reservations)) return bookings;

  let changed = false;
  const reservations = bookings.reservations.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const payment = asObject(row.payment);
    const copy = copies.get(id) ?? null;
    if (!copy && payment.group === undefined) return item;
    changed = true;
    return { ...row, payment: applyGroupCopyToPayment(payment, copy) };
  });

  return changed ? { ...bookings, reservations } : bookings;
}
