// E-mails du paiement à plusieurs : organisateur, amis invités à régler leur part, hôte. Fonctions
// pures (aucun accès base). Aperçu : `npx tsx src/domains/notifications/preview.cli.ts`.

import type { RenderedEmail } from './bookingConfirmation.js';
import { formatMinor, formatShortRange, renderHostEmail, type HostEmailBlock } from './hostEmailKit.js';
import {
  formatDateTime,
  formatGuests,
  formatStayRange,
  greet,
  pluralize,
  type GuestsBreakdown,
  type MailRow,
} from './mailLayout.js';

export type GroupStay = {
  listingTitle: string;
  listingCity: string | null;
  startDate: Date;
  endDate: Date;
  nights: number;
};

export type GroupSummary = {
  /** Nom de la personne qui a réservé. */
  organizerName: string;
  payers: number;
  paidCount: number;
  currency: string;
  /** Montant réglé en ligne par le groupe, en centimes. */
  totalAmountMinor: number;
  expiresAt: Date;
};

export type GroupCloseReason = 'expired' | 'organizer' | 'host';

const ORGANIZER_NOTE = 'Vous recevez cet e-mail parce que vous avez réservé ce séjour en paiement à plusieurs.';

function participantNote(organizerName: string): string {
  return `Vous recevez cet e-mail parce que ${organizerName} a indiqué votre adresse pour partager le paiement de ce séjour. Elle ne sert qu’à cette réservation.`;
}

/** « Bonjour Julien, » plutôt que « Bonjour Julien Bernard, ». */
function hello(name: string | null | undefined): string {
  const first = name?.trim().split(/\s+/)[0] ?? null;
  return greet(first);
}

function where(stay: GroupStay): string {
  return stay.listingCity ? `${stay.listingTitle} (${stay.listingCity})` : stay.listingTitle;
}

/** « 29 novembre 2026 à 14:05 (heure de Paris) ». */
function deadline(date: Date): string {
  return `${formatDateTime(date)} (heure de Paris)`;
}

function parts(count: number): string {
  return pluralize(count, 'part');
}

const HOLD_EXPLANATION = (payers: number, expiresAt: Date) =>
  `Votre carte est seulement autorisée : elle n’est débitée que lorsque les ${payers} parts sont réglées. Si le groupe n’est pas complet le ${deadline(expiresAt)}, la réservation est annulée et rien n’est débité.`;

// --- Organisateur : sa part est enregistrée ------------------------------------------------------

export type GroupOrganizerStartedEmailData = GroupStay & GroupSummary & {
  shareAmountMinor: number;
  groupUrl: string;
};

export function buildGroupOrganizerStartedEmail(data: GroupOrganizerStartedEmailData): RenderedEmail {
  const rows: MailRow[] = [
    { label: 'Logement', value: where(data), strong: true },
    { label: 'Séjour', value: formatStayRange(data.startDate, data.endDate, data.nights) },
    { label: 'À régler par le groupe', value: `${formatMinor(data.totalAmountMinor, data.currency)}, en ${parts(data.payers)}` },
    { label: 'Votre part', value: formatMinor(data.shareAmountMinor, data.currency) },
    { label: 'À compléter avant le', value: deadline(data.expiresAt), strong: true },
  ];

  return renderHostEmail({
    audience: 'guest',
    legalNote: ORGANIZER_NOTE,
    subject: `Votre part est enregistrée : invitez vos amis (${data.listingTitle})`,
    title: 'Il reste à inviter vos amis',
    preheader: `${data.listingTitle} · ${parts(data.payers)} · avant le ${formatDateTime(data.expiresAt)}`,
    blocks: [
      { kind: 'paragraph', text: `${hello(data.organizerName)} votre part est enregistrée et les dates sont bloquées pour votre groupe. Indiquez l’adresse e-mail de chacun de vos amis : ils recevront un lien pour régler leur part.` },
      { kind: 'rows', rows },
      { kind: 'button', label: 'Inviter mes amis', href: data.groupUrl },
      { kind: 'notice', text: HOLD_EXPLANATION(data.payers, data.expiresAt) },
      { kind: 'paragraph', text: 'Conservez ce lien : il est personnel et vous permet de suivre les paiements, de relancer un ami ou d’annuler la réservation.', muted: true },
    ],
  });
}

// --- Ami : invitation et rappels -----------------------------------------------------------------

export type GroupInvitationEmailData = GroupStay & GroupSummary & {
  shareAmountMinor: number;
  payUrl: string;
};

export function buildGroupInvitationEmail(data: GroupInvitationEmailData): RenderedEmail {
  const share = formatMinor(data.shareAmountMinor, data.currency);
  const rows: MailRow[] = [
    { label: 'Logement', value: where(data), strong: true },
    { label: 'Séjour', value: formatStayRange(data.startDate, data.endDate, data.nights) },
    { label: 'Votre part', value: share, strong: true },
    { label: 'À régler avant le', value: deadline(data.expiresAt) },
  ];

  return renderHostEmail({
    audience: 'guest',
    legalNote: participantNote(data.organizerName),
    subject: `${data.organizerName} vous invite à régler votre part : ${data.listingTitle}`,
    title: 'Votre part du séjour',
    preheader: `${share} · ${data.listingTitle} · ${formatShortRange(data.startDate, data.endDate)}`,
    blocks: [
      { kind: 'paragraph', text: `Bonjour, ${data.organizerName} a réservé ce séjour et partage le paiement entre ${data.payers} personnes. Votre part est de ${share}.` },
      { kind: 'rows', rows },
      { kind: 'button', label: 'Régler ma part', href: data.payUrl },
      { kind: 'notice', text: HOLD_EXPLANATION(data.payers, data.expiresAt) },
    ],
  });
}

export type GroupReminderEmailData = GroupInvitationEmailData & {
  /** 1, 2 ou 3 (dernier rappel). */
  stage: number;
  /** « 48 h », « 6 h ». */
  timeLeft: string;
};

export function buildGroupReminderEmail(data: GroupReminderEmailData): RenderedEmail {
  const share = formatMinor(data.shareAmountMinor, data.currency);
  const last = data.stage >= 3;

  return renderHostEmail({
    audience: 'guest',
    legalNote: participantNote(data.organizerName),
    subject: `${last ? 'Dernier rappel' : 'Rappel'} : il reste ${data.timeLeft} pour régler votre part (${data.listingTitle})`,
    title: last ? 'Dernier rappel : votre part reste à régler' : 'Votre part reste à régler',
    preheader: `${share} avant le ${formatDateTime(data.expiresAt)}`,
    blocks: [
      { kind: 'paragraph', text: `Bonjour, ${data.organizerName} attend encore votre part de ${share} pour ${where(data)}, ${formatStayRange(data.startDate, data.endDate, data.nights)}.` },
      { kind: 'rows', rows: [
        { label: 'Parts réglées', value: `${data.paidCount} sur ${data.payers}` },
        { label: 'À régler avant le', value: deadline(data.expiresAt), strong: true },
      ] },
      { kind: 'button', label: 'Régler ma part', href: data.payUrl },
      { kind: 'notice', text: `Sans toutes les parts à l’échéance, la réservation est annulée pour tout le groupe. Personne n’est débité avant que les ${data.payers} parts soient réglées.` },
    ],
  });
}

// --- Organisateur : point avant l'échéance -------------------------------------------------------

export type GroupOrganizerReminderEmailData = GroupStay & GroupSummary & {
  timeLeft: string;
  /** Amis qui n'ont pas réglé : adresse, ou `null` si l'invitation n'a pas encore été envoyée. */
  pending: Array<string | null>;
  groupUrl: string;
};

export function buildGroupOrganizerReminderEmail(data: GroupOrganizerReminderEmailData): RenderedEmail {
  const missing = data.payers - data.paidCount;
  const notInvited = data.pending.filter((email) => !email).length;
  const blocks: HostEmailBlock[] = [
    { kind: 'paragraph', text: `${hello(data.organizerName)} ${data.paidCount} ${data.paidCount > 1 ? 'parts sont réglées' : 'part est réglée'} sur ${data.payers} pour ${where(data)}. Il reste ${data.timeLeft} à votre groupe, jusqu’au ${deadline(data.expiresAt)}.` },
    { kind: 'section', title: missing > 1 ? 'Parts encore attendues' : 'Part encore attendue' },
    { kind: 'list', items: data.pending.map((email) => email ?? 'Invitation pas encore envoyée') },
  ];
  if (notInvited > 0) {
    blocks.push({ kind: 'notice', text: `${notInvited > 1 ? `${notInvited} amis n’ont` : 'Un ami n’a'} pas encore reçu d’invitation : indiquez ${notInvited > 1 ? 'leurs adresses' : 'son adresse'} pour qu’${notInvited > 1 ? 'ils reçoivent leur lien' : 'il reçoive son lien'}.` });
  }
  blocks.push(
    { kind: 'button', label: 'Voir mon groupe', href: data.groupUrl },
    { kind: 'paragraph', text: 'Depuis cette page, vous pouvez renvoyer une invitation, corriger une adresse ou copier le lien d’un ami pour le lui envoyer vous-même.', muted: true },
  );

  return renderHostEmail({
    audience: 'guest',
    legalNote: ORGANIZER_NOTE,
    subject: `Il manque ${parts(missing)} : plus que ${data.timeLeft} (${data.listingTitle})`,
    title: missing > 1 ? `Il manque encore ${missing} parts` : 'Il manque encore une part',
    preheader: `${data.paidCount} sur ${data.payers} · avant le ${formatDateTime(data.expiresAt)}`,
    blocks,
  });
}

// --- Groupe complet : amis (l'organisateur reçoit la confirmation de réservation) -----------------

export type GroupParticipantConfirmedEmailData = GroupStay & GroupSummary & {
  participantName: string | null;
  shareAmountMinor: number;
  shareUrl: string;
};

export function buildGroupParticipantConfirmedEmail(data: GroupParticipantConfirmedEmailData): RenderedEmail {
  const share = formatMinor(data.shareAmountMinor, data.currency);

  return renderHostEmail({
    audience: 'guest',
    legalNote: 'Cet e-mail confirme le règlement de votre part : conservez-le.',
    subject: `Réservation confirmée : ${data.listingTitle}, ${formatShortRange(data.startDate, data.endDate)}`,
    title: 'Le groupe est complet',
    preheader: `Votre part de ${share} est débitée · ${data.listingTitle}`,
    blocks: [
      { kind: 'paragraph', text: `${hello(data.participantName)} les ${data.payers} parts sont réglées : la réservation est confirmée. Votre part de ${share} vient d’être débitée de votre carte.` },
      { kind: 'rows', rows: [
        { label: 'Logement', value: where(data), strong: true },
        { label: 'Séjour', value: formatStayRange(data.startDate, data.endDate, data.nights) },
        { label: 'Votre part', value: share },
        { label: 'Réservé par', value: data.organizerName },
      ] },
      { kind: 'paragraph', text: `${data.organizerName} a reçu la confirmation et le guide d’arrivée du logement, avec les conditions d’annulation de l’hôte.`, muted: true },
      { kind: 'button', label: 'Voir le récapitulatif', href: data.shareUrl },
    ],
  });
}

// --- Groupe non abouti ---------------------------------------------------------------------------

export type GroupClosedEmailData = GroupStay & GroupSummary & {
  recipientName: string | null;
  isOrganizer: boolean;
  reason: GroupCloseReason;
  /** Ce qu'il advient de la part du destinataire. */
  shareOutcome: 'released' | 'refunded' | 'unpaid';
  shareAmountMinor: number;
};

function closedIntro(data: GroupClosedEmailData): string {
  const stay = `${where(data)}, ${formatStayRange(data.startDate, data.endDate, data.nights)}`;
  if (data.reason === 'expired') {
    const paid = data.paidCount > 1
      ? `seules ${data.paidCount} parts sur ${data.payers} ont été réglées`
      : `seule ${data.paidCount} part sur ${data.payers} a été réglée`;
    return `${hello(data.recipientName)} ${paid} avant le ${deadline(data.expiresAt)}. La réservation de ${stay}, est annulée.`;
  }
  if (data.reason === 'host') {
    return `${hello(data.recipientName)} l’hôte a annulé la réservation de ${stay}, avant que le groupe ait fini de payer.`;
  }
  return data.isOrganizer
    ? `${hello(data.recipientName)} votre annulation de la réservation de ${stay}, est enregistrée.`
    : `${hello(data.recipientName)} ${data.organizerName} a annulé la réservation de ${stay}.`;
}

function closedShareLine(data: GroupClosedEmailData): string {
  const share = formatMinor(data.shareAmountMinor, data.currency);
  if (data.shareOutcome === 'released') {
    return `Votre carte n’a pas été débitée. L’autorisation de ${share} est levée ; selon les banques, elle disparaît de votre relevé en quelques jours.`;
  }
  if (data.shareOutcome === 'refunded') {
    return `Votre part de ${share} vous est remboursée en entier, sur la carte utilisée. Le remboursement apparaît en général sous 5 à 10 jours ouvrés.`;
  }
  return 'Vous n’aviez pas réglé votre part : rien ne vous est demandé.';
}

export function buildGroupClosedEmail(data: GroupClosedEmailData): RenderedEmail {
  const blocks: HostEmailBlock[] = [
    { kind: 'paragraph', text: closedIntro(data) },
    { kind: 'notice', text: closedShareLine(data) },
  ];
  if (data.reason === 'expired') {
    blocks.push({ kind: 'paragraph', text: 'Les dates sont de nouveau ouvertes à la réservation. Si votre groupe est prêt, il suffit de réserver à nouveau.', muted: true });
  }

  return renderHostEmail({
    audience: 'guest',
    legalNote: data.isOrganizer ? ORGANIZER_NOTE : participantNote(data.organizerName),
    subject: data.reason === 'expired'
      ? `Réservation annulée : le groupe n’a pas été complété (${data.listingTitle})`
      : `Réservation annulée : ${data.listingTitle}`,
    title: 'Réservation annulée',
    preheader: data.shareOutcome === 'unpaid' ? data.listingTitle : `Aucun débit · ${data.listingTitle}`,
    blocks,
  });
}

// --- Réservation confirmée puis annulée : amis ---------------------------------------------------

export type GroupParticipantCanceledEmailData = GroupStay & GroupSummary & {
  participantName: string | null;
  canceledBy: 'guest' | 'host';
  shareAmountMinor: number;
  refundedAmountMinor: number;
};

export function buildGroupParticipantCanceledEmail(data: GroupParticipantCanceledEmailData): RenderedEmail {
  const share = formatMinor(data.shareAmountMinor, data.currency);
  const refunded = formatMinor(data.refundedAmountMinor, data.currency);
  const by = data.canceledBy === 'host' ? 'l’hôte' : data.organizerName;
  const refundLine = data.refundedAmountMinor <= 0
    ? `Selon les conditions d’annulation de l’hôte, votre part de ${share} n’est pas remboursée.`
    : data.refundedAmountMinor >= data.shareAmountMinor
      ? `Votre part de ${share} vous est remboursée en entier, sur la carte utilisée. Le remboursement apparaît en général sous 5 à 10 jours ouvrés.`
      : `Sur votre part de ${share}, ${refunded} vous sont remboursés, selon les conditions d’annulation de l’hôte. Le remboursement apparaît en général sous 5 à 10 jours ouvrés.`;

  return renderHostEmail({
    audience: 'guest',
    legalNote: participantNote(data.organizerName),
    subject: `Réservation annulée : ${data.listingTitle}`,
    title: 'Réservation annulée',
    preheader: `${data.listingTitle} · ${formatShortRange(data.startDate, data.endDate)}`,
    blocks: [
      { kind: 'paragraph', text: `${hello(data.participantName)} la réservation de ${where(data)}, ${formatStayRange(data.startDate, data.endDate, data.nights)}, a été annulée par ${by}.` },
      { kind: 'notice', text: refundLine },
    ],
  });
}

/// --- Ami retiré du groupe ------------------------------------------------------------------------

export type GroupParticipantRemovedEmailData = GroupStay & GroupSummary & {
  participantName: string | null;
};

export function buildGroupParticipantRemovedEmail(data: GroupParticipantRemovedEmailData): RenderedEmail {
  return renderHostEmail({
    audience: 'guest',
    legalNote: participantNote(data.organizerName),
    subject: `Vous n’avez plus rien à régler : ${data.listingTitle}`,
    title: 'Vous n’avez plus de part à régler',
    preheader: `${data.listingTitle} · ${formatShortRange(data.startDate, data.endDate)}`,
    blocks: [
      { kind: 'paragraph', text: `${hello(data.participantName)} ${data.organizerName} a modifié le groupe qui partage le paiement de ${where(data)}, ${formatStayRange(data.startDate, data.endDate, data.nights)} : vous n’en faites plus partie.` },
      { kind: 'notice', text: 'Vous n’avez rien à régler, et le lien reçu précédemment ne fonctionne plus. Si vous aviez commencé un paiement, il est annulé et votre carte n’est pas débitée.' },
    ],
  });
}

// --- Hôte ----------------------------------------------------------------------------------------

export type HostGroupPendingEmailData = GroupStay & GroupSummary & {
  hostFirstName: string | null;
  guests: GuestsBreakdown;
  managementUrl: string;
};

export function buildHostGroupPendingEmail(data: HostGroupPendingEmailData): RenderedEmail {
  const range = formatShortRange(data.startDate, data.endDate);
  const total = formatMinor(data.totalAmountMinor, data.currency);

  return renderHostEmail({
    subject: `Réservation en attente : ${data.organizerName}, ${range} (paiement à plusieurs)`,
    title: 'Réservation en attente du groupe',
    preheader: `${data.organizerName} · ${data.listingTitle} · ${range}`,
    blocks: [
      { kind: 'paragraph', text: `${hello(data.hostFirstName)} ${data.organizerName} vient de réserver en paiement à plusieurs : ${data.payers} personnes se partagent ${total}. La première part est réglée, les autres ont jusqu’au ${deadline(data.expiresAt)}.` },
      { kind: 'rows', rows: [
        { label: 'Logement', value: data.listingTitle, strong: true },
        { label: 'Séjour', value: formatStayRange(data.startDate, data.endDate, data.nights) },
        { label: 'Voyageurs', value: formatGuests(data.guests) },
        { label: 'À régler en ligne', value: `${total}, en ${parts(data.payers)}` },
        { label: 'Parts réglées', value: `${data.paidCount} sur ${data.payers}` },
      ] },
      { kind: 'notice', text: 'Vos dates sont bloquées d’ici là. Rien n’est encaissé tant que le groupe n’est pas complet : s’il ne l’est pas à l’échéance, la réservation s’annule d’elle-même, vos dates se libèrent et vous n’avez aucun frais.' },
      { kind: 'button', label: 'Voir la réservation', href: data.managementUrl },
      { kind: 'paragraph', text: 'Vous recevrez un e-mail dès que le groupe est complet, ou si la réservation n’aboutit pas.', muted: true },
    ],
  });
}

export type HostGroupClosedEmailData = GroupStay & GroupSummary & {
  hostFirstName: string | null;
  reason: Exclude<GroupCloseReason, 'host'>;
  managementUrl: string;
};

export function buildHostGroupClosedEmail(data: HostGroupClosedEmailData): RenderedEmail {
  const range = formatShortRange(data.startDate, data.endDate);
  const intro = data.reason === 'expired'
    ? `${hello(data.hostFirstName)} le groupe de ${data.organizerName} n’a pas réglé toutes ses parts dans le délai (${data.paidCount} sur ${data.payers}). La réservation est annulée.`
    : `${hello(data.hostFirstName)} ${data.organizerName} a annulé sa réservation avant que son groupe ait fini de payer.`;

  return renderHostEmail({
    subject: `Réservation non aboutie : ${data.organizerName}, ${range}`,
    title: 'Réservation non aboutie',
    preheader: `${data.listingTitle} · ${range} · dates de nouveau disponibles`,
    blocks: [
      { kind: 'paragraph', text: intro },
      { kind: 'rows', rows: [
        { label: 'Logement', value: data.listingTitle, strong: true },
        { label: 'Séjour', value: formatStayRange(data.startDate, data.endDate, data.nights) },
      ] },
      { kind: 'notice', text: 'Vos dates sont de nouveau ouvertes à la réservation. Rien n’a été encaissé sur votre compte Stripe, et vous n’avez aucun frais.' },
      { kind: 'button', label: 'Voir mon calendrier', href: data.managementUrl },
    ],
  });
}
