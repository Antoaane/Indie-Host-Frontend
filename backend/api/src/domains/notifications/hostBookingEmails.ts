// E-mails aux hôtes liés à une réservation : nouvelle réservation, annulation, arrivée le lendemain,
// message ou avis d'un voyageur, litige et remboursement échoué. Fonctions pures (aucun accès base).

import type { BalanceMode, RenderedEmail } from './bookingConfirmation.js';
import { describeBalance, formatShortRange, renderHostEmail, type HostEmailBlock } from './hostEmailKit.js';
import {
  formatCurrency,
  formatGuests,
  formatShortDate,
  formatStayRange,
  greet,
  type GuestsBreakdown,
  type MailRow,
} from './mailLayout.js';

export type HostStay = {
  listingTitle: string;
  guestName: string;
  startDate: Date;
  endDate: Date;
  nights: number;
};

export type GuestContact = {
  email: string | null;
  phone: string | null;
};

function contactRows(contact: GuestContact): MailRow[] {
  const rows: MailRow[] = [];
  if (contact.phone) rows.push({ label: 'Téléphone', value: contact.phone });
  if (contact.email) rows.push({ label: 'E-mail', value: contact.email });
  return rows;
}

// --- Nouvelle réservation -------------------------------------------------------------------

export type HostBookingReceivedEmailData = HostStay & {
  hostFirstName: string | null;
  guests: GuestsBreakdown;
  contact: GuestContact;
  currency: string;
  /** Montants en euros. */
  total: number;
  paidNow: number;
  balance: number;
  balanceMode: BalanceMode;
  balanceDueDate: Date | null;
  travellerMessage: string | null;
  managementUrl: string;
};

export function buildHostBookingReceivedEmail(data: HostBookingReceivedEmailData): RenderedEmail {
  const range = formatShortRange(data.startDate, data.endDate);
  const paid = data.paidNow > 0
    ? `${formatCurrency(data.paidNow, data.currency)} ont été encaissés sur votre compte Stripe.`
    : 'Le paiement se fera à l’arrivée.';
  const balance = describeBalance(
    data.balance,
    data.balanceMode,
    data.currency,
    data.balanceDueDate ? formatShortDate(data.balanceDueDate) : null,
  );

  const rows: MailRow[] = [
    { label: 'Logement', value: data.listingTitle, strong: true },
    { label: 'Séjour', value: formatStayRange(data.startDate, data.endDate, data.nights) },
    { label: 'Voyageurs', value: formatGuests(data.guests) },
    { label: 'Total', value: formatCurrency(data.total, data.currency) },
    ...(balance ? [{ label: 'Reste à percevoir', value: balance }] : []),
    ...contactRows(data.contact),
  ];

  const blocks: HostEmailBlock[] = [
    { kind: 'paragraph', text: `${greet(data.hostFirstName)} ${data.guestName} vient de réserver. ${paid}` },
    { kind: 'rows', rows },
  ];
  if (data.travellerMessage) {
    blocks.push({ kind: 'section', title: `Message de ${data.guestName}` });
    blocks.push({ kind: 'notice', text: data.travellerMessage });
  }
  blocks.push(
    { kind: 'button', label: 'Voir la réservation', href: data.managementUrl },
    { kind: 'paragraph', text: 'Les dates sont bloquées sur votre calendrier IndieHost.', muted: true },
  );

  return renderHostEmail({
    subject: `Nouvelle réservation : ${data.guestName}, ${range}`,
    title: 'Nouvelle réservation',
    preheader: `${data.guestName} · ${data.listingTitle} · ${range}`,
    blocks,
  });
}

// --- Annulation ------------------------------------------------------------------------------

export type HostBookingCanceledEmailData = HostStay & {
  hostFirstName: string | null;
  canceledBy: 'guest' | 'host';
  currency: string;
  /** Montants en euros. */
  chargedAmount: number;
  refundedAmount: number;
  retainedAmount: number;
  reason: string | null;
  managementUrl: string;
};

export function buildHostBookingCanceledEmail(data: HostBookingCanceledEmailData): RenderedEmail {
  const range = formatShortRange(data.startDate, data.endDate);
  const byHost = data.canceledBy === 'host';
  const refunded = formatCurrency(data.refundedAmount, data.currency);

  const intro = byHost
    ? `${greet(data.hostFirstName)} votre annulation du séjour de ${data.guestName} est enregistrée. Le voyageur a été prévenu par e-mail.`
    : `${greet(data.hostFirstName)} ${data.guestName} a annulé son séjour. Les dates sont de nouveau disponibles.`;

  const rows: MailRow[] = [
    { label: 'Logement', value: data.listingTitle, strong: true },
    { label: 'Séjour annulé', value: formatStayRange(data.startDate, data.endDate, data.nights) },
  ];
  if (data.chargedAmount > 0) {
    rows.push(
      { label: 'Payé par le voyageur', value: formatCurrency(data.chargedAmount, data.currency) },
      { label: 'Remboursé', value: refunded },
      { label: 'Vous conservez', value: formatCurrency(data.retainedAmount, data.currency), strong: true },
    );
  }
  if (data.reason) rows.push({ label: 'Motif indiqué', value: data.reason });

  const blocks: HostEmailBlock[] = [
    { kind: 'paragraph', text: intro },
    { kind: 'rows', rows },
  ];
  if (data.refundedAmount > 0) {
    blocks.push({
      kind: 'paragraph',
      text: byHost
        ? `Le remboursement intégral (${refunded}) est prélevé sur votre solde Stripe.`
        : `Le remboursement (${refunded}) suit le barème d’annulation de l’annonce et est prélevé sur votre solde Stripe.`,
    });
  }
  if (byHost) {
    blocks.push({ kind: 'paragraph', text: 'Les dates sont de nouveau disponibles à la réservation.' });
  }
  blocks.push({ kind: 'button', label: 'Voir mon calendrier', href: data.managementUrl });

  return renderHostEmail({
    subject: byHost
      ? `Annulation confirmée : ${data.guestName}, ${range}`
      : `Réservation annulée : ${data.guestName}, ${range}`,
    title: byHost ? 'Vous avez annulé une réservation' : 'Réservation annulée par le voyageur',
    preheader: `${data.listingTitle} · ${range}`,
    blocks,
  });
}

// --- Arrivée demain --------------------------------------------------------------------------

export type HostArrivalTomorrowEmailData = HostStay & {
  hostFirstName: string | null;
  guests: GuestsBreakdown;
  contact: GuestContact;
  currency: string;
  /** Solde restant en euros et son mode de règlement. */
  balance: number;
  balanceMode: BalanceMode;
  travellerMessage: string | null;
  messagesUrl: string;
};

export function buildHostArrivalTomorrowEmail(data: HostArrivalTomorrowEmailData): RenderedEmail {
  const rows: MailRow[] = [
    { label: 'Logement', value: data.listingTitle, strong: true },
    { label: 'Séjour', value: formatStayRange(data.startDate, data.endDate, data.nights) },
    { label: 'Voyageurs', value: formatGuests(data.guests) },
    ...contactRows(data.contact),
  ];

  const blocks: HostEmailBlock[] = [
    { kind: 'paragraph', text: `${greet(data.hostFirstName)} ${data.guestName} arrive demain.` },
    { kind: 'rows', rows },
  ];
  if (data.balanceMode === 'cash' && data.balance > 0) {
    blocks.push({ kind: 'notice', text: `À encaisser à l’arrivée, en espèces : ${formatCurrency(data.balance, data.currency)}.` });
  }
  if (data.travellerMessage) {
    blocks.push({ kind: 'section', title: 'Message joint à la réservation' });
    blocks.push({ kind: 'notice', text: data.travellerMessage });
  }
  blocks.push(
    { kind: 'paragraph', text: 'Le voyageur a reçu le lien de votre guide d’arrivée avec sa confirmation. Un mot pour convenir de l’heure d’arrivée est toujours apprécié.' },
    { kind: 'button', label: 'Écrire au voyageur', href: data.messagesUrl },
  );

  return renderHostEmail({
    subject: `Arrivée demain : ${data.guestName}, ${data.listingTitle}`,
    title: 'Arrivée demain',
    preheader: `${data.guestName} · ${formatGuests(data.guests)}`,
    blocks,
  });
}

// --- Message d'un voyageur -------------------------------------------------------------------

export type HostGuestMessageEmailData = {
  hostFirstName: string | null;
  guestName: string;
  listingTitle: string;
  excerpt: string;
  stay: { startDate: Date; endDate: Date } | null;
  messagesUrl: string;
};

export function buildHostGuestMessageEmail(data: HostGuestMessageEmailData): RenderedEmail {
  const stay = data.stay ? ` (séjour du ${formatShortRange(data.stay.startDate, data.stay.endDate)})` : '';
  return renderHostEmail({
    subject: `Message de ${data.guestName} : ${data.listingTitle}`,
    title: `Message de ${data.guestName}`,
    preheader: data.excerpt.slice(0, 120),
    blocks: [
      { kind: 'paragraph', text: `${greet(data.hostFirstName)} ${data.guestName} vous a écrit au sujet de « ${data.listingTitle} »${stay}.` },
      { kind: 'notice', text: data.excerpt },
      { kind: 'button', label: 'Répondre', href: data.messagesUrl },
      {
        kind: 'paragraph',
        text: 'Répondez depuis votre messagerie IndieHost : une réponse à cet e-mail arrive à notre support, pas au voyageur.',
        muted: true,
      },
    ],
  });
}

// --- Avis d'un voyageur ----------------------------------------------------------------------

export type HostReviewReceivedEmailData = {
  hostFirstName: string | null;
  listingTitle: string;
  author: string;
  rating: number;
  text: string;
  listingUrl: string;
};

export function buildHostReviewReceivedEmail(data: HostReviewReceivedEmailData): RenderedEmail {
  const rating = Math.min(5, Math.max(1, Math.round(data.rating)));
  const stars = `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`;
  return renderHostEmail({
    subject: `Nouvel avis ${rating}/5 sur ${data.listingTitle}`,
    title: 'Nouvel avis voyageur',
    preheader: `${data.author} · ${rating}/5`,
    blocks: [
      { kind: 'paragraph', text: `${greet(data.hostFirstName)} ${data.author} a laissé un avis sur « ${data.listingTitle} ». Il est déjà publié sur votre annonce.` },
      { kind: 'rows', rows: [{ label: 'Note', value: `${stars} ${rating}/5`, strong: true }] },
      { kind: 'notice', text: data.text },
      { kind: 'button', label: 'Voir l’annonce', href: data.listingUrl },
    ],
  });
}

// --- Litige ----------------------------------------------------------------------------------

const DISPUTE_REASONS: Record<string, string> = {
  fraudulent: 'Paiement non reconnu par le titulaire de la carte',
  unrecognized: 'Paiement non reconnu par le titulaire de la carte',
  product_not_received: 'Séjour non fourni',
  product_unacceptable: 'Séjour non conforme à l’annonce',
  duplicate: 'Paiement en double',
  credit_not_processed: 'Remboursement attendu non reçu',
  subscription_canceled: 'Paiement contesté après annulation',
};

export type HostDisputeEmailData = {
  hostFirstName: string | null;
  listingTitle: string;
  guestName: string | null;
  amountMinor: number;
  currency: string;
  reason: string | null;
  evidenceDueBy: Date | null;
};

export function buildHostDisputeEmail(data: HostDisputeEmailData): RenderedEmail {
  const amount = formatCurrency(Math.max(0, data.amountMinor) / 100, data.currency);
  const who = data.guestName ? `${data.guestName} (ou sa banque)` : 'Un voyageur (ou sa banque)';
  const rows: MailRow[] = [
    { label: 'Logement', value: data.listingTitle },
    { label: 'Montant contesté', value: amount, strong: true },
    { label: 'Motif', value: DISPUTE_REASONS[data.reason ?? ''] ?? 'Autre motif' },
  ];
  if (data.evidenceDueBy) rows.push({ label: 'Répondre avant le', value: formatShortDate(data.evidenceDueBy), strong: true });

  return renderHostEmail({
    subject: `Paiement contesté : ${amount}, ${data.listingTitle}`,
    title: 'Un paiement est contesté',
    preheader: `${amount} · réponse à apporter dans votre Dashboard Stripe`,
    blocks: [
      { kind: 'paragraph', text: `${greet(data.hostFirstName)} ${who} conteste un paiement. Stripe a retiré ce montant de votre solde le temps de l’examen.` },
      { kind: 'rows', rows },
      { kind: 'paragraph', text: 'Répondez depuis votre Dashboard Stripe (Paiements, puis Litiges) en joignant vos preuves :' },
      {
        kind: 'list',
        items: [
          'la confirmation de réservation et les dates du séjour ;',
          'vos échanges avec le voyageur dans la messagerie ;',
          'le règlement intérieur et les conditions d’annulation acceptés au paiement.',
        ],
      },
      { kind: 'button', label: 'Ouvrir mon Dashboard Stripe', href: 'https://dashboard.stripe.com/' },
      { kind: 'paragraph', text: 'Sans réponse avant la date limite, la banque donne raison au voyageur.', muted: true },
    ],
  });
}

// --- Remboursement échoué --------------------------------------------------------------------

export type HostRefundFailedEmailData = {
  hostFirstName: string | null;
  listingTitle: string;
  guestName: string | null;
  amountMinor: number;
  currency: string;
  contact: GuestContact;
  messagesUrl: string;
};

export function buildHostRefundFailedEmail(data: HostRefundFailedEmailData): RenderedEmail {
  const amount = formatCurrency(Math.max(0, data.amountMinor) / 100, data.currency);
  const guest = data.guestName ?? 'le voyageur';
  return renderHostEmail({
    subject: `Remboursement non abouti : ${amount}`,
    title: 'Un remboursement n’a pas abouti',
    preheader: `${amount} · ${data.listingTitle}`,
    blocks: [
      {
        kind: 'paragraph',
        text: `${greet(data.hostFirstName)} le remboursement de ${amount} à ${guest} a été refusé par sa banque (carte expirée ou compte fermé, le plus souvent). Le voyageur n’a donc pas été remboursé.`,
      },
      { kind: 'rows', rows: [{ label: 'Logement', value: data.listingTitle }, ...contactRows(data.contact)] },
      { kind: 'paragraph', text: 'Le montant est revenu sur votre solde Stripe. Contactez le voyageur pour convenir d’un autre moyen, par exemple un virement.' },
      { kind: 'button', label: 'Écrire au voyageur', href: data.messagesUrl },
    ],
  });
}
