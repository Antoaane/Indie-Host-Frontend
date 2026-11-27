// Envoi des e-mails du paiement à plusieurs (gabarits : `groupPaymentEmails.ts`). Comme les autres
// notifications, chaque fonction attrape tout et journalise : un e-mail ne fait jamais échouer un
// paiement ni une réservation.

import type { PrismaClient } from '@prisma/client';

import { resolvePublicBaseUrl, sendMail } from '../../lib/mailer.js';
import { buildGroupShareKey, buildGroupSharePath } from '../bookings/groupPaymentKey.js';
import type { GroupCloseReason, GroupWithShares } from '../bookings/groupPaymentLedger.js';
import { allocateGroupRefund } from '../bookings/groupPaymentRules.js';
import type { RenderedEmail } from './bookingConfirmation.js';
import {
  buildGroupClosedEmail,
  buildGroupInvitationEmail,
  buildGroupOrganizerReminderEmail,
  buildGroupOrganizerStartedEmail,
  buildGroupParticipantCanceledEmail,
  buildGroupParticipantConfirmedEmail,
  buildGroupParticipantRemovedEmail,
  buildGroupReminderEmail,
  buildHostGroupClosedEmail,
  buildHostGroupPendingEmail,
  type GroupStay,
  type GroupSummary,
} from './groupPaymentEmails.js';
import { buildHostLinks, deliverHostEmail, hostFirstName, loadListingHost } from './hostNotifications.js';
import { readGuestsBreakdown } from './mailLayout.js';
import { buildAbsoluteUrl, type BookingNotificationContext } from './notifications.service.js';

type Share = GroupWithShares['shares'][number];

const PAID_SHARE_STATUSES = new Set(['authorized', 'captured']);

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function describe(access: BookingNotificationContext, group: GroupWithShares): GroupStay & GroupSummary {
  return {
    listingTitle: readString(access.listingCore.title) ?? 'Votre logement',
    listingCity: readString(access.listingCore.city),
    startDate: access.startDate,
    endDate: access.endDate,
    nights: Math.max(1, Math.round(access.nights)),
    organizerName: readString(access.guestName) ?? 'L’organisateur',
    payers: group.payersCount,
    paidCount: group.shares.filter((share) => PAID_SHARE_STATUSES.has(share.status)).length,
    currency: group.currency.toUpperCase(),
    totalAmountMinor: group.totalAmountMinor,
    expiresAt: group.expiresAt,
  };
}

/** Lien personnel d'une part, sur le site où la réservation a été faite (domaine de l'hôte). */
export function buildGroupShareUrl(group: Pick<GroupWithShares, 'publicBaseUrl'>, shareId: string): string {
  return buildAbsoluteUrl(buildGroupSharePath(buildGroupShareKey(shareId)), resolvePublicBaseUrl(group.publicBaseUrl));
}

function organizerShare(group: GroupWithShares): Share | null {
  return group.shares.find((share) => share.position === 0) ?? null;
}

function organizerEmail(access: BookingNotificationContext, group: GroupWithShares): string | null {
  return readString(organizerShare(group)?.email) ?? readString(access.reservationContact.email);
}

async function deliver(to: string | null, email: RenderedEmail, tag: string, context: Record<string, unknown>): Promise<boolean> {
  if (!to) return false;
  const result = await sendMail({ to, ...email, tags: ['voyageur', tag], context: { ...context, email: tag } });
  return result.ok;
}

async function safely<T>(label: string, context: Record<string, unknown>, fallback: T, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.error(`[notifications] e-mail du paiement à plusieurs non envoyé (${label})`, { ...context, error });
    return fallback;
  }
}

function logContext(access: BookingNotificationContext, group: GroupWithShares) {
  return { reservationId: access.reservationId, listingId: access.listingId, groupId: group.id };
}

// --- Création ------------------------------------------------------------------------------------

async function organizerStarted(input: { access: BookingNotificationContext; group: GroupWithShares; guests?: Record<string, unknown> }): Promise<void> {
  const { access, group } = input;
  await safely('group_organizer_started', logContext(access, group), undefined, async () => {
    const share = organizerShare(group);
    if (!share) return;
    await deliver(
      organizerEmail(access, group),
      buildGroupOrganizerStartedEmail({
        ...describe(access, group),
        shareAmountMinor: share.amountMinor,
        groupUrl: buildGroupShareUrl(group, share.id),
      }),
      'group_organizer_started',
      logContext(access, group),
    );
  });
}

async function hostPending(
  prisma: PrismaClient,
  input: { access: BookingNotificationContext; group: GroupWithShares; guests?: Record<string, unknown> },
): Promise<void> {
  const { access, group } = input;
  await safely('group_booking_pending', logContext(access, group), undefined, async () => {
    const owner = await loadListingHost(prisma, access.listingId);
    if (!owner) return;

    await deliverHostEmail(prisma, {
      host: owner.host,
      kind: 'group_booking_pending',
      claims: [{ dedupeKey: `group_booking_pending:${access.reservationId}`, refId: access.reservationId }],
      email: buildHostGroupPendingEmail({
        ...describe(access, group),
        listingTitle: owner.listingTitle,
        hostFirstName: hostFirstName(owner.host),
        guests: readGuestsBreakdown(input.guests ?? {}),
        managementUrl: buildHostLinks().management,
      }),
      context: logContext(access, group),
    });
  });
}

// --- Invitation et rappels -----------------------------------------------------------------------

async function invitation(input: { access: BookingNotificationContext; group: GroupWithShares; share: Share }): Promise<boolean> {
  const { access, group, share } = input;
  return safely('group_invitation', { ...logContext(access, group), shareId: share.id }, false, async () =>
    deliver(
      readString(share.email),
      buildGroupInvitationEmail({
        ...describe(access, group),
        shareAmountMinor: share.amountMinor,
        payUrl: buildGroupShareUrl(group, share.id),
      }),
      'group_invitation',
      { ...logContext(access, group), shareId: share.id },
    ));
}

/** Rappel aux amis qui n'ont pas réglé, et point à l'organisateur. Renvoie le nombre d'e-mails partis. */
async function reminders(input: { access: BookingNotificationContext; group: GroupWithShares; stage: number; timeLeft: string }): Promise<number> {
  const { access, group } = input;
  const summary = describe(access, group);
  const pending = group.shares.filter((share) => share.position > 0 && share.status === 'pending');
  if (!pending.length) return 0;

  let sent = 0;
  for (const share of pending) {
    const delivered = await safely('group_reminder', { ...logContext(access, group), shareId: share.id }, false, async () =>
      deliver(
        readString(share.email),
        buildGroupReminderEmail({
          ...summary,
          shareAmountMinor: share.amountMinor,
          payUrl: buildGroupShareUrl(group, share.id),
          stage: input.stage,
          timeLeft: input.timeLeft,
        }),
        'group_reminder',
        { ...logContext(access, group), shareId: share.id, stage: input.stage },
      ));
    if (delivered) sent += 1;
  }

  const organizer = organizerShare(group);
  const delivered = organizer
    ? await safely('group_organizer_reminder', logContext(access, group), false, async () =>
      deliver(
        organizerEmail(access, group),
        buildGroupOrganizerReminderEmail({
          ...summary,
          timeLeft: input.timeLeft,
          pending: pending.map((share) => readString(share.email)),
          groupUrl: buildGroupShareUrl(group, organizer.id),
        }),
        'group_organizer_reminder',
        { ...logContext(access, group), stage: input.stage },
      ))
    : false;
  return delivered ? sent + 1 : sent;
}

//** Ami retiré du groupe par l'organisateur : il n'a plus rien à régler. */
async function participantRemoved(input: { access: BookingNotificationContext; group: GroupWithShares; share: Share }): Promise<boolean> {
  const { access, group, share } = input;
  return safely('group_participant_removed', { ...logContext(access, group), shareId: share.id }, false, async () =>
    deliver(
      readString(share.email),
      buildGroupParticipantRemovedEmail({ ...describe(access, group), participantName: readString(share.name) }),
      'group_participant_removed',
      { ...logContext(access, group), shareId: share.id },
    ));
}

// --- Issue ---------------------------------------------------------------------------------------

/** Groupe complet : chaque ami apprend que sa part est débitée (l'organisateur reçoit la confirmation). */
async function participantsConfirmed(input: { access: BookingNotificationContext; group: GroupWithShares }): Promise<void> {
  const { access, group } = input;
  const summary = describe(access, group);
  for (const share of group.shares) {
    if (share.position === 0 || share.status !== 'captured') continue;
    await safely('group_participant_confirmed', { ...logContext(access, group), shareId: share.id }, false, async () =>
      deliver(
        readString(share.email),
        buildGroupParticipantConfirmedEmail({
          ...summary,
          paidCount: group.payersCount,
          participantName: readString(share.name),
          shareAmountMinor: share.amountMinor,
          shareUrl: buildGroupShareUrl(group, share.id),
        }),
        'group_participant_confirmed',
        { ...logContext(access, group), shareId: share.id },
      ));
  }
}

/** Groupe non abouti : tous ceux dont l'adresse est connue, puis l'hôte (sauf s'il a annulé lui-même). */
async function groupClosed(
  prisma: PrismaClient,
  input: { access: BookingNotificationContext; group: GroupWithShares; reason: GroupCloseReason; refundedMinor: number },
): Promise<void> {
  const { access, group, reason } = input;
  // Parts réglées avant la clôture : une part levée ou remboursée avait été autorisée.
  const paidCount = group.shares.filter((share) => Boolean(share.authorizedAt)).length;
  const summary = { ...describe(access, group), paidCount };

  for (const share of group.shares) {
    const isOrganizer = share.position === 0;
    const to = isOrganizer ? organizerEmail(access, group) : readString(share.email);
    const shareOutcome = share.status === 'refunded' ? 'refunded' : share.authorizedAt ? 'released' : 'unpaid';
    await safely('group_closed', { ...logContext(access, group), shareId: share.id }, false, async () =>
      deliver(
        to,
        buildGroupClosedEmail({
          ...summary,
          recipientName: isOrganizer ? summary.organizerName : readString(share.name),
          isOrganizer,
          reason,
          shareOutcome,
          shareAmountMinor: share.amountMinor,
        }),
        'group_closed',
        { ...logContext(access, group), shareId: share.id, reason },
      ));
  }

  if (reason === 'host') return;
  await safely('group_booking_closed', logContext(access, group), undefined, async () => {
    const owner = await loadListingHost(prisma, access.listingId);
    if (!owner) return;
    await deliverHostEmail(prisma, {
      host: owner.host,
      kind: 'group_booking_closed',
      claims: [{ dedupeKey: `group_booking_closed:${access.reservationId}`, refId: access.reservationId }],
      email: buildHostGroupClosedEmail({
        ...summary,
        listingTitle: owner.listingTitle,
        hostFirstName: hostFirstName(owner.host),
        reason,
        managementUrl: buildHostLinks().management,
      }),
      context: logContext(access, group),
    });
  });
}

/**
 * Réservation confirmée puis annulée : chaque ami apprend ce qui lui est remboursé. `group` est l'état
 * avant remboursement (parts débitées) ; la répartition est celle du registre (`allocateGroupRefund`).
 */
async function participantsReservationCanceled(input: {
  access: BookingNotificationContext;
  group: GroupWithShares;
  canceledBy: 'guest' | 'host';
  chargedAmountMinor: number;
  refundedAmountMinor: number;
}): Promise<void> {
  const { access, group } = input;
  const summary = describe(access, group);
  const charged = group.shares.filter((share) => share.status === 'captured' || share.status === 'refunded');
  const refunds = allocateGroupRefund(charged.map((share) => share.amountMinor), input.refundedAmountMinor);

  for (const [index, share] of charged.entries()) {
    if (share.position === 0) continue;
    await safely('group_participant_canceled', { ...logContext(access, group), shareId: share.id }, false, async () =>
      deliver(
        readString(share.email),
        buildGroupParticipantCanceledEmail({
          ...summary,
          participantName: readString(share.name),
          canceledBy: input.canceledBy,
          shareAmountMinor: share.amountMinor,
          refundedAmountMinor: refunds[index] ?? 0,
        }),
        'group_participant_canceled',
        { ...logContext(access, group), shareId: share.id },
      ));
  }
}

export const groupPaymentNotifications = {
  organizerStarted,
  hostPending,
  invitation,
  participantRemoved,
  reminders,
  participantsConfirmed,
  groupClosed,
  participantsReservationCanceled,
} as const;
