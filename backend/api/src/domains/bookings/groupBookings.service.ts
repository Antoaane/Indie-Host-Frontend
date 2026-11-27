// Paiement à plusieurs : ce que font l'organisateur et ses amis depuis leur lien personnel (page de
// suivi, invitations, règlement d'une part), et le passage planifié qui débite un groupe complet,
// envoie les rappels et clôt un groupe dont le délai est dépassé.
//
// Les règles sont dans `groupPaymentRules.ts`, les paiements dans `groupPaymentLedger.ts`, et tout ce
// qui touche à la réservation (confirmation, annulation, dates) dans `BookingsService`.

import type { PrismaClient } from '@prisma/client';

import { asObject, toNumber } from '../../lib/json.js';
import { isDeprecatedHostIdentity } from '../users/users.repository.js';
import { groupPaymentNotifications } from '../notifications/groupPaymentNotifications.js';
import type { BookingsService, ReservationAccessContext } from './bookings.service.js';
import { describeCancellationPolicy, summarizeCancellationPolicy } from './cancellationPolicy.js';
import { toGroupPaymentPublicStatus, type GroupPaymentPublicStatus } from './groupPaymentCopy.js';
import { buildGroupShareKey, buildGroupSharePath, parseGroupShareKey } from './groupPaymentKey.js';
import {
  groupPaymentError,
  isGroupFullyPaid,
  type GroupCloseReason,
  type GroupPaymentLedger,
  type GroupShareIntent,
  type GroupWithShares,
} from './groupPaymentLedger.js';
import {
  formatGroupTimeLeft,
  GROUP_PAYMENT_MIN_PAYERS,
  normalizeParticipantEmail,
  resolveDueGroupReminder,
  resolveGroupMaxPayers,
} from './groupPaymentRules.js';

type Share = GroupWithShares['shares'][number];

/** Invitations envoyées au plus à une même part : la route est ouverte sans compte. */
export const GROUP_INVITATIONS_PER_SHARE_MAX = 5;
// Débit ou levée restés en cours plus longtemps : le traitement s'est interrompu, il est repris.
const STALE_PROCESSING_MS = 2 * 60 * 1000;
const SCHEDULED_PASS_MAX_GROUPS = 200;
const PAID_SHARE_STATUSES = new Set(['authorized', 'captured']);

export type GroupParticipantView = {
  position: number;
  isOrganizer: boolean;
  isYou: boolean;
  label: string;
  status: 'paid' | 'pending' | 'released';
  amountMinor: number;
  /** Gestion du groupe : réservée à l'organisateur. */
  shareId?: string;
  email?: string | null;
  invitedAtISO?: string | null;
  payPath?: string;
  canResend?: boolean;
};

export type GroupPaymentPage = {
  role: 'organizer' | 'participant';
  status: GroupPaymentPublicStatus;
  /** Débit des parts ou annulation en cours : l'état définitif arrive dans la minute. */
  processing: boolean;
  closeReason: GroupCloseReason | null;
  /** Aucune clé Stripe (développement) : paiements simulés. */
  mock: boolean;
  listing: { id: string; title: string; city: string | null; image: string | null };
  host: { name: string };
  stay: {
    startISO: string;
    endISO: string;
    nights: number;
    guests: { adults: number; children: number; infants: number; pets: number };
  };
  amounts: {
    currency: string;
    /** Total du séjour, en centimes. */
    totalMinor: number;
    /** Montant réglé en ligne par le groupe. */
    onlineTotalMinor: number;
    deferredMinor: number;
    deferredMode: 'none' | 'online' | 'cash';
    deferredDueDateISO: string | null;
  };
  group: {
    payers: number;
    paidCount: number;
    expiresAtISO: string;
    createdAtISO: string;
    organizerName: string;
  };
  share: {
    position: number;
    status: 'paid' | 'pending' | 'released';
    amountMinor: number;
    name: string | null;
  };
  participants: GroupParticipantView[];
  actions: {
    canPay: boolean;
    canInvite: boolean;
    canCancel: boolean;
    /** Organisateur : ajouter une personne (les parts baissent). */
    canAddPayer: boolean;
    /** Organisateur : retirer un ami qui n'a pas réglé (possible tant qu'aucun ami n'a réglé). */
    canRemovePayer: boolean;
  };
  /** Nombre de payeurs possible pour ce séjour. */
  limits: { minPayers: number; maxPayers: number };
  cancellation: { summary: string; lines: string[] };
  /** Organisateur, groupe complet : sa page de confirmation (guide d'arrivée, annulation). */
  confirmationPath: string | null;
};

export type GroupShareIntentResult = GroupShareIntent & { status: 'ready' };

export type GroupPaymentsPassReport = {
  groups: number;
  sharesAuthorized: number;
  completed: number;
  expired: number;
  remindersSent: number;
  errors: Array<{ groupId: string; message: string }>;
};

type Context = {
  group: GroupWithShares;
  share: Share;
  access: ReservationAccessContext;
};

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function toMinor(amountMajor: unknown): number {
  return Math.max(0, Math.round(toNumber(amountMajor, 0) * 100));
}

function shareViewStatus(share: Share): 'paid' | 'pending' | 'released' {
  if (PAID_SHARE_STATUSES.has(share.status)) return 'paid';
  return share.status === 'pending' ? 'pending' : 'released';
}

/** « Julie M. » : un ami ne voit pas le nom complet des autres. */
function shortName(name: string): string {
  const [first = '', ...rest] = name.trim().split(/\s+/);
  const initial = rest.at(-1)?.slice(0, 1);
  return initial ? `${first} ${initial.toUpperCase()}.` : first;
}

function isOverdue(group: GroupWithShares, now: Date): boolean {
  return now.getTime() >= group.expiresAt.getTime();
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? 'Erreur inconnue.');
}

export class GroupBookingsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly bookings: BookingsService,
    private readonly ledger: GroupPaymentLedger,
  ) {}

  private async resolve(shareKey: string): Promise<Context | 'forbidden' | null> {
    const shareId = parseGroupShareKey(shareKey);
    if (!shareId) return 'forbidden';

    const found = await this.ledger.findByShareId(shareId);
    if (!found) return null;
    const access = await this.bookings.getReservationAccess(found.group.reservationId);
    if (!access) return null;
    return { ...found, access };
  }

  private async buildPage(context: Context, now = new Date()): Promise<GroupPaymentPage> {
    const { group, share, access } = context;
    const [listing, reservation] = await Promise.all([
      this.prisma.listing.findUnique({ where: { id: group.listingId }, select: { medias: true } }),
      this.prisma.reservation.findUnique({ where: { id: group.reservationId }, select: { guests: true } }),
    ]);

    const isOrganizer = share.position === 0;
    const fullyPaid = isGroupFullyPaid(group);
    const overdue = group.status === 'pending' && !fullyPaid && isOverdue(group, now);
    // Délai dépassé : la page l'annonce tout de suite, la tâche planifiée lève les empreintes dans les minutes qui suivent.
    const status: GroupPaymentPublicStatus = overdue ? 'expired' : toGroupPaymentPublicStatus(group);
    const open = group.status === 'pending' && !overdue;

    const images = asObject(listing?.medias).images;
    const firstImage = Array.isArray(images)
      ? [...images]
          .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
          .sort((a, b) => toNumber(a.position, 0) - toNumber(b.position, 0))[0]
      : null;

    const payment = access.payment;
    const stripe = asObject(payment.stripe);
    const deferredModeRaw = readString(stripe.deferredMode);
    const guests = asObject(reservation?.guests);
    const maxPayers = resolveGroupMaxPayers({
      adults: Math.trunc(toNumber(guests.adults, 0)),
      chargeNowAmountMinor: group.totalAmountMinor,
    });
    const hostName = readString(access.listingHost.name);
    const organizerName = readString(access.guestName) ?? 'L’organisateur';
    const cancellationSettings = asObject(asObject(access.listingBookings.pricing).cancellation);

    const participants = group.shares.map((item): GroupParticipantView => {
      const itemIsOrganizer = item.position === 0;
      const name = readString(item.name);
      const email = readString(item.email);
      const label = itemIsOrganizer
        ? organizerName
        : isOrganizer
          ? name ?? email ?? `Ami n° ${item.position}`
          : name ? shortName(name) : `Ami n° ${item.position}`;
      const view: GroupParticipantView = {
        position: item.position,
        isOrganizer: itemIsOrganizer,
        isYou: item.id === share.id,
        label,
        status: shareViewStatus(item),
        amountMinor: item.amountMinor,
      };
      if (!isOrganizer || itemIsOrganizer) return view;
      return {
        ...view,
        shareId: item.id,
        email,
        invitedAtISO: item.invitedAt ? item.invitedAt.toISOString() : null,
        payPath: buildGroupSharePath(buildGroupShareKey(item.id)),
        canResend: open && item.status === 'pending' && Boolean(email) && item.invitationsSent < GROUP_INVITATIONS_PER_SHARE_MAX,
      };
    });

    return {
      role: isOrganizer ? 'organizer' : 'participant',
      status,
      processing: group.status === 'capturing' || group.status === 'releasing' || overdue,
      closeReason: overdue
        ? 'expired'
        : group.closeReason === 'expired' || group.closeReason === 'organizer' || group.closeReason === 'host'
          ? group.closeReason
          : null,
      mock: this.ledger.isMock(),
      listing: {
        id: group.listingId,
        title: readString(access.listingCore.title) ?? 'Logement',
        city: readString(access.listingCore.city),
        image: readString(firstImage?.src),
      },
      host: {
        name: (hostName && !isDeprecatedHostIdentity(hostName) ? hostName : null) ?? access.ownerDisplayName ?? 'Votre hôte',
      },
      stay: {
        startISO: access.startDate.toISOString().slice(0, 10),
        endISO: access.endDate.toISOString().slice(0, 10),
        nights: Math.max(1, Math.trunc(toNumber(access.nights, 1))),
        guests: {
          adults: Math.max(0, Math.trunc(toNumber(guests.adults, 0))),
          children: Math.max(0, Math.trunc(toNumber(guests.children, 0))),
          infants: Math.max(0, Math.trunc(toNumber(guests.infants, 0))),
          pets: Math.max(0, Math.trunc(toNumber(guests.pets, 0))),
        },
      },
      amounts: {
        currency: group.currency,
        totalMinor: toMinor(payment.total),
        onlineTotalMinor: group.totalAmountMinor,
        deferredMinor: toMinor(stripe.deferredAmount ?? payment.balance),
        deferredMode: deferredModeRaw === 'cash' || deferredModeRaw === 'online' ? deferredModeRaw : 'none',
        deferredDueDateISO: readString(stripe.deferredDueDateISO),
      },
      group: {
        payers: group.payersCount,
        paidCount: group.shares.filter((item) => PAID_SHARE_STATUSES.has(item.status)).length,
        expiresAtISO: group.expiresAt.toISOString(),
        createdAtISO: group.createdAt.toISOString(),
        organizerName,
      },
      share: {
        position: share.position,
        status: shareViewStatus(share),
        amountMinor: share.amountMinor,
        name: readString(share.name),
      },
      participants,
      actions: {
        canPay: open && share.status === 'pending',
        canInvite: open && isOrganizer,
        canCancel: isOrganizer && group.status === 'pending',
        canAddPayer: open && isOrganizer && group.payersCount < maxPayers,
        canRemovePayer: open && isOrganizer
          && group.payersCount > GROUP_PAYMENT_MIN_PAYERS
          && !group.shares.some((item) => item.position > 0 && PAID_SHARE_STATUSES.has(item.status)),
      },
      limits: { minPayers: GROUP_PAYMENT_MIN_PAYERS, maxPayers },
      cancellation: {
        summary: summarizeCancellationPolicy(cancellationSettings),
        lines: describeCancellationPolicy(cancellationSettings),
      },
      confirmationPath: isOrganizer && status === 'completed'
        ? `/booking/confirmation/${encodeURIComponent(group.reservationId)}?${new URLSearchParams({
            token: access.confirmation.guideAccessKey,
            listingId: group.listingId,
          })}`
        : null,
    };
  }

  private async reload(shareKey: string): Promise<GroupPaymentPage | 'forbidden' | null> {
    const context = await this.resolve(shareKey);
    if (!context || context === 'forbidden') return context;
    return this.buildPage(context);
  }

  async getPage(shareKey: string): Promise<GroupPaymentPage | 'forbidden' | null> {
    return this.reload(shareKey);
  }

  /** PaymentIntent de la part : le règlement se fait ensuite dans le navigateur, avec Stripe. */
  async createShareIntent(shareKey: string, input: { name?: string | null }): Promise<GroupShareIntent | 'forbidden' | null> {
    const context = await this.resolve(shareKey);
    if (!context || context === 'forbidden') return context;
    const { group, share, access } = context;

    return this.ledger.ensureShareIntent({
      group,
      share,
      payerName: readString(input.name),
      ownerId: access.ownerId,
      stay: {
        startISO: access.startDate.toISOString().slice(0, 10),
        endISO: access.endDate.toISOString().slice(0, 10),
      },
    });
  }

  /**
   * Après la validation du paiement dans le navigateur : la part est relue chez Stripe, puis le
   * groupe est débité s'il est complet.
   */
  async confirmShare(shareKey: string): Promise<GroupPaymentPage | 'forbidden' | null> {
    const context = await this.resolve(shareKey);
    if (!context || context === 'forbidden') return context;
    const { group, share } = context;

    const authorized = await this.ledger.refreshShare(group, share, { assumeAuthorized: this.ledger.isMock() });
    if (authorized) await this.bookings.syncGroupPaymentCopy(group.reservationId);
    await this.advance(group.id);
    return this.reload(shareKey);
  }

  /**
   * L'organisateur indique ou corrige l'adresse de ses amis, ou redemande l'envoi d'une invitation.
   * Une invitation part quand l'adresse est nouvelle ou sur demande, dans la limite prévue par part.
   */
  async invite(
    shareKey: string,
    invitations: Array<{ shareId: string; email: string; resend?: boolean }>,
  ): Promise<GroupPaymentPage | 'forbidden' | null> {
    const context = await this.resolve(shareKey);
    if (!context || context === 'forbidden') return context;
    const { group, share, access } = context;
    if (share.position !== 0) return 'forbidden';

    const now = new Date();
    if (group.status !== 'pending' || isOverdue(group, now)) {
      throw groupPaymentError('Ce paiement à plusieurs est clos : les invitations ne partent plus.', 409, 'GROUP_PAYMENT_CLOSED');
    }

    const byId = new Map(group.shares.map((item) => [item.id, item]));
    const taken = new Map<string, string>();
    for (const item of group.shares) {
      const email = readString(item.email)?.toLowerCase();
      if (email && item.position > 0) taken.set(item.id, email);
    }

    const planned: Array<{ target: Share; email: string; send: boolean }> = [];
    for (const invitation of invitations) {
      const target = byId.get(invitation.shareId);
      if (!target || target.position === 0) {
        throw groupPaymentError('Cette part n’appartient pas à votre groupe.', 400, 'GROUP_SHARE_UNKNOWN');
      }
      const email = normalizeParticipantEmail(invitation.email);
      if (!email) {
        throw groupPaymentError('Saisissez une adresse e-mail valide pour chaque ami.', 400, 'GROUP_INVITATION_EMAIL_INVALID', { shareId: target.id });
      }
      if (target.status !== 'pending') continue;

      const changed = email !== readString(target.email)?.toLowerCase();
      taken.set(target.id, email);
      planned.push({ target, email, send: changed || Boolean(invitation.resend) });
    }

    const emails = [...taken.values()];
    if (new Set(emails).size !== emails.length) {
      throw groupPaymentError('Chaque ami doit avoir sa propre adresse e-mail.', 400, 'GROUP_INVITATION_EMAIL_DUPLICATE');
    }

    for (const { target, email, send } of planned) {
      if (send && target.invitationsSent >= GROUP_INVITATIONS_PER_SHARE_MAX) {
        throw groupPaymentError(
          'Trop d’invitations ont déjà été envoyées pour cette part. Copiez le lien de votre ami et envoyez-le-lui directement.',
          429,
          'GROUP_INVITATION_LIMIT',
          { shareId: target.id },
        );
      }
    }

    for (const { target, email, send } of planned) {
      const updated = await this.prisma.groupPaymentShare.update({
        where: { id: target.id },
        data: {
          email,
          ...(send ? { invitedAt: now, invitationsSent: { increment: 1 } } : {}),
        },
      });
      if (send) void groupPaymentNotifications.invitation({ access, group, share: updated });
    }

    return this.reload(shareKey);
  }

  /**
   * L'organisateur ajoute une personne au groupe, ou retire un ami qui n'a pas réglé
   * (`GroupPaymentLedger.resizeGroup` : règles et parts recalculées).
   */
  async changePayers(
    shareKey: string,
    change: { kind: 'add' } | { kind: 'remove'; shareId: string },
  ): Promise<GroupPaymentPage | 'forbidden' | null> {
    const context = await this.resolve(shareKey);
    if (!context || context === 'forbidden') return context;
    const { group, share, access } = context;
    if (share.position !== 0) return 'forbidden';

    const reservation = await this.prisma.reservation.findUnique({ where: { id: group.reservationId }, select: { guests: true } });
    const maxPayers = resolveGroupMaxPayers({
      adults: Math.trunc(toNumber(asObject(reservation?.guests).adults, 0)),
      chargeNowAmountMinor: group.totalAmountMinor,
    });

    const result = await this.ledger.resizeGroup({ groupId: group.id, change, maxPayers });
    await this.bookings.syncGroupPaymentCopy(group.reservationId);

    // Un ami retiré qui avait reçu une invitation apprend qu'il n'a plus rien à régler.
    const removed: Share | null = result.removed;
    if (removed && readString(removed.email) && removed.invitedAt) {
      const refreshed = await this.ledger.findById(group.id);
      if (refreshed) void groupPaymentNotifications.participantRemoved({ access, group: refreshed, share: removed });
    }
    return this.reload(shareKey);
  }

  /** L'organisateur annule avant que le groupe soit complet : personne n'est débité. */
  async cancel(shareKey: string): Promise<GroupPaymentPage | 'forbidden' | null> {
    const context = await this.resolve(shareKey);
    if (!context || context === 'forbidden') return context;
    const { group, share } = context;
    if (share.position !== 0) return 'forbidden';

    if (group.status === 'completed') {
      throw groupPaymentError(
        'Le groupe est complet : la réservation est confirmée. Pour l’annuler, passez par votre page de confirmation.',
        409,
        'GROUP_PAYMENT_COMPLETED',
      );
    }

    const outcome = await this.bookings.closePendingGroupReservation(group.reservationId, 'organizer');
    if (outcome === 'busy') {
      throw groupPaymentError('Le paiement du groupe est en cours de traitement. Réessayez dans une minute.', 409, 'GROUP_PAYMENT_BUSY');
    }
    return this.reload(shareKey);
  }

  // --- Avancement d'un groupe ------------------------------------------------------------------

  /**
   * Fait avancer un groupe : débit s'il est complet, clôture si le délai est dépassé, reprise d'un
   * traitement interrompu. Sans effet sinon.
   */
  async advance(groupId: string, now = new Date()): Promise<'pending' | 'completed' | 'expired' | 'busy' | 'closed' | 'not_found'> {
    const group = await this.ledger.findById(groupId);
    if (!group) return 'not_found';

    if (group.status === 'completed') return 'completed';
    if (group.status === 'expired' || group.status === 'canceled') return 'closed';

    const stale = !group.processingAt || now.getTime() - group.processingAt.getTime() > STALE_PROCESSING_MS;

    if (group.status === 'capturing') {
      return stale ? this.capture(group.id, now) : 'busy';
    }

    if (group.status === 'releasing') {
      if (!stale) return 'busy';
      const reason: GroupCloseReason = group.closeReason === 'host' || group.closeReason === 'organizer' ? group.closeReason : 'expired';
      const outcome = await this.bookings.closePendingGroupReservation(group.reservationId, reason);
      return outcome === 'closed' ? (reason === 'expired' ? 'expired' : 'closed') : 'busy';
    }

    if (isGroupFullyPaid(group)) {
      // Complet : débité même si l'échéance vient de passer, tout le monde a tenu son engagement.
      const claimed = await this.ledger.claim(group.id, ['pending'], 'capturing', { processingAt: now });
      return claimed ? this.capture(group.id, now) : 'busy';
    }

    if (isOverdue(group, now)) {
      const outcome = await this.bookings.closePendingGroupReservation(group.reservationId, 'expired');
      return outcome === 'closed' ? 'expired' : 'busy';
    }

    return 'pending';
  }

  private async capture(groupId: string, now: Date): Promise<'pending' | 'completed' | 'busy' | 'not_found'> {
    await this.ledger.touchProcessing(groupId, now);
    const group = await this.ledger.findById(groupId);
    if (!group) return 'not_found';

    const outcome = await this.ledger.captureShares(group, now);
    if (outcome.lost.length) {
      // Une autorisation a disparu (carte, banque) : la part est de nouveau à régler. Les parts déjà
      // débitées le restent ; si le groupe ne se complète pas, elles sont remboursées à l'échéance.
      console.warn('[group-payments] authorization lost at capture, share reopened', {
        groupId,
        shares: outcome.lost.map((share) => share.id),
      });
      await this.ledger.claim(groupId, ['capturing'], 'pending', { processingAt: null });
      await this.bookings.syncGroupPaymentCopy(group.reservationId);
      return 'pending';
    }
    if (outcome.retry.length) return 'busy';

    const completed = await this.ledger.claim(groupId, ['capturing'], 'completed', { completedAt: now, processingAt: null });
    if (completed) await this.bookings.confirmGroupReservation(group.reservationId);
    return 'completed';
  }

  // --- Passage planifié --------------------------------------------------------------------------

  /** Groupes en cours, du plus proche de l'échéance au plus lointain (aperçu `--dry-run`). */
  async listOpenGroups(now = new Date()) {
    const groups = await this.prisma.groupPayment.findMany({
      where: { status: { in: ['pending', 'capturing', 'releasing'] } },
      include: { shares: { orderBy: { position: 'asc' } } },
      orderBy: { expiresAt: 'asc' },
      take: SCHEDULED_PASS_MAX_GROUPS,
    });

    return groups.map((group) => {
      const due = resolveDueGroupReminder({ expiresAt: group.expiresAt, now, remindersSent: group.remindersSent });
      return {
        groupId: group.id,
        reservationId: group.reservationId,
        listingId: group.listingId,
        status: group.status,
        payers: group.payersCount,
        paid: group.shares.filter((share) => PAID_SHARE_STATUSES.has(share.status)).length,
        invited: group.shares.filter((share) => share.position > 0 && Boolean(share.email)).length,
        expiresAt: group.expiresAt.toISOString(),
        overdue: isOverdue(group, now),
        remindersSent: group.remindersSent,
        reminderDue: due ? due.stage : null,
      };
    });
  }

  /**
   * Passage planifié (`jobs/groupPayments.ts`) : relit chez Stripe les parts en cours de règlement,
   * débite les groupes complets, clôt ceux dont le délai est dépassé et envoie les rappels dus.
   */
  async runScheduledPass(now = new Date()): Promise<GroupPaymentsPassReport> {
    const report: GroupPaymentsPassReport = { groups: 0, sharesAuthorized: 0, completed: 0, expired: 0, remindersSent: 0, errors: [] };
    const groups = await this.prisma.groupPayment.findMany({
      where: { status: { in: ['pending', 'capturing', 'releasing'] } },
      include: { shares: { orderBy: { position: 'asc' } } },
      orderBy: { expiresAt: 'asc' },
      take: SCHEDULED_PASS_MAX_GROUPS,
    });
    report.groups = groups.length;

    for (const group of groups) {
      try {
        if (group.status === 'pending') {
          // Un ami a pu valider son paiement puis fermer la page avant que le site ne le signale.
          let authorized = 0;
          for (const share of group.shares) {
            if (share.status !== 'pending' || !share.stripePaymentIntentId) continue;
            if (await this.ledger.refreshShare(group, share, { now })) authorized += 1;
          }
          if (authorized) {
            report.sharesAuthorized += authorized;
            await this.bookings.syncGroupPaymentCopy(group.reservationId);
          }
        }

        const result = await this.advance(group.id, now);
        if (result === 'completed') report.completed += 1;
        if (result === 'expired') report.expired += 1;
        if (result === 'pending') report.remindersSent += await this.sendDueReminder(group.id, now);
      } catch (error) {
        console.error('[group-payments] scheduled pass failed for a group', { groupId: group.id, error });
        report.errors.push({ groupId: group.id, message: readErrorMessage(error) });
      }
    }

    return report;
  }

  private async sendDueReminder(groupId: string, now: Date): Promise<number> {
    const group = await this.ledger.findById(groupId);
    if (!group || group.status !== 'pending') return 0;

    const due = resolveDueGroupReminder({ expiresAt: group.expiresAt, now, remindersSent: group.remindersSent });
    if (!due) return 0;

    // Le rappel est noté avant l'envoi : deux passages qui se chevauchent n'en envoient qu'un.
    const claimed = await this.prisma.groupPayment.updateMany({
      where: { id: group.id, status: 'pending', remindersSent: { lt: due.stage } },
      data: { remindersSent: due.stage },
    });
    if (claimed.count !== 1) return 0;

    const access = await this.bookings.getReservationAccess(group.reservationId);
    if (!access) return 0;

    return groupPaymentNotifications.reminders({
      access,
      group,
      stage: due.stage,
      timeLeft: formatGroupTimeLeft(group.expiresAt.getTime() - now.getTime()),
    });
  }
}
