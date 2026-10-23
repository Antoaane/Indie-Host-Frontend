// E-mail envoyé au voyageur quand sa réservation est annulée (par lui-même ou par l'hôte).

import { describeCancellationPolicy, summarizeCancellationPolicy } from '../bookings/cancellationPolicy.js';
import {
  formatCurrency,
  formatDateTime,
  formatStayRange,
  greet,
  renderButton,
  renderDocument,
  renderList,
  renderNotice,
  renderParagraph,
  renderPlainText,
  renderRows,
  renderSectionTitle,
  textList,
  textRows,
  type MailRow,
} from './mailLayout.js';
import type { RenderedEmail } from './bookingConfirmation.js';

export type BookingCancellationEmailData = {
  reservationId: string;
  listingTitle: string;
  listingCity: string | null;
  hostName: string | null;
  guestName: string;
  startDate: Date;
  endDate: Date;
  nights: number;
  currency: string;
  canceledBy: 'guest' | 'host';
  canceledAt: Date;
  /** Montants en unités majeures (euros). */
  chargedAmount: number;
  refundedAmount: number;
  retainedAmount: number;
  reason: string | null;
  cancellationSettings: unknown;
  confirmationUrl: string;
};

const LEGAL_NOTE =
  'Cet e-mail confirme l’annulation de votre réservation et tient lieu de justificatif ; conservez-le avec votre confirmation initiale.';

export function buildBookingCancellationEmail(data: BookingCancellationEmailData): RenderedEmail {
  const hostLabel = data.hostName?.trim() || 'votre hôte';
  const stay = formatStayRange(data.startDate, data.endDate, data.nights);
  const where = data.listingCity ? `${data.listingTitle} (${data.listingCity})` : data.listingTitle;
  const byHost = data.canceledBy === 'host';

  const title = byHost ? 'Votre réservation a été annulée par l’hôte' : 'Votre annulation est enregistrée';
  const subject = byHost
    ? `Réservation annulée par l’hôte : ${data.listingTitle}, ${stay}`
    : `Annulation confirmée : ${data.listingTitle}, ${stay}`;

  const intro = byHost
    ? `${greet(data.guestName)} ${hostLabel} a annulé votre séjour. Conformément aux conditions voyageurs, vous êtes remboursé intégralement des sommes versées.`
    : `${greet(data.guestName)} nous confirmons l’annulation de votre réservation. Vos dates sont libérées et le barème d’annulation de l’annonce a été appliqué.`;

  const stayRows: MailRow[] = [
    { label: 'Logement', value: where, strong: true },
    ...(data.hostName?.trim() ? [{ label: 'Hôte', value: hostLabel }] : []),
    { label: 'Séjour annulé', value: stay },
    { label: 'Référence', value: data.reservationId },
    { label: 'Annulée le', value: formatDateTime(data.canceledAt) },
    { label: 'À l’initiative de', value: byHost ? 'l’hôte' : 'vous-même' },
  ];
  if (data.reason) stayRows.push({ label: 'Motif indiqué', value: data.reason });

  const refundRows: MailRow[] = [
    { label: 'Sommes versées', value: formatCurrency(data.chargedAmount, data.currency) },
    { label: 'Montant remboursé', value: formatCurrency(data.refundedAmount, data.currency), strong: true },
    { label: 'Montant retenu', value: formatCurrency(data.retainedAmount, data.currency) },
  ];

  const refundNotice = data.refundedAmount > 0
    ? 'Le remboursement est émis sur le moyen de paiement utilisé lors de la réservation. Selon votre banque, il apparaît sous 5 à 10 jours ouvrés.'
    : 'Aucun remboursement n’est dû au titre du barème appliqué.';

  const policyLines = describeCancellationPolicy(data.cancellationSettings);
  const policySummary = summarizeCancellationPolicy(data.cancellationSettings);

  const html = renderDocument({
    title,
    preheader: `${data.listingTitle} — ${stay}`,
    body: [
      renderParagraph(intro),
      renderSectionTitle('Réservation concernée'),
      renderRows(stayRows),
      renderSectionTitle('Remboursement'),
      renderRows(refundRows),
      renderNotice(refundNotice),
      ...(byHost
        ? []
        : [renderSectionTitle(`Barème appliqué (${policySummary})`), renderList(policyLines)]),
      renderParagraph('Le détail de l’annulation reste consultable sur votre page de confirmation :', { muted: true }),
      renderButton('Voir le détail', data.confirmationUrl),
      renderParagraph(
        'Une question sur ce remboursement ? Écrivez à votre hôte depuis la messagerie de votre réservation, ou à IndieHost si la situation n’est pas résolue.',
        { muted: true },
      ),
    ],
    legalNote: LEGAL_NOTE,
  });

  const text = renderPlainText(
    title,
    [
      intro,
      `RÉSERVATION CONCERNÉE\n${textRows(stayRows)}`,
      `REMBOURSEMENT\n${textRows(refundRows)}\n${refundNotice}`,
      ...(byHost ? [] : [`BARÈME APPLIQUÉ (${policySummary})\n${textList(policyLines)}`]),
      `Détail de l’annulation : ${data.confirmationUrl}`,
      'Une question sur ce remboursement ? Écrivez à votre hôte depuis la messagerie de votre réservation, ou à IndieHost si la situation n’est pas résolue.',
    ],
    LEGAL_NOTE,
  );

  return { subject, text, html };
}
