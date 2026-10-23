// E-mail de confirmation de réservation envoyé au voyageur après paiement : support durable du contrat
// (art. L221-13 du Code de la consommation). Contenu en français, vouvoiement.

import { describeCancellationPolicy, summarizeCancellationPolicy } from '../bookings/cancellationPolicy.js';
import {
  formatCurrency,
  formatGuests,
  formatShortDate,
  formatStayRange,
  greet,
  parseIsoDate,
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
  type GuestsBreakdown,
  type MailRow,
} from './mailLayout.js';

export type BalanceMode = 'none' | 'online' | 'cash';

export type BookingConfirmationEmailData = {
  reservationId: string;
  listingTitle: string;
  listingCity: string | null;
  /** Nom d'affichage de l'hôte ; `null` → « votre hôte ». */
  hostName: string | null;
  guestName: string;
  startDate: Date;
  endDate: Date;
  nights: number;
  guests: GuestsBreakdown;
  currency: string;
  amounts: {
    total: number;
    paidNow: number;
    balance: number;
    balanceMode: BalanceMode;
    balanceDueDateISO: string | null;
  };
  /** Choix de paiement du parcours (`full` / `split` / `cash`) ou libellé libre de l'hôte. */
  paymentChoice: string | null;
  paymentMethodLabel: string | null;
  /** Préférences brutes `bookings.pricing.cancellation` de l'annonce. */
  cancellationSettings: unknown;
  /** Liens absolus. */
  guideUrl: string;
  confirmationUrl: string;
  /** Message laissé par le voyageur à la réservation, repris pour mémoire. */
  travellerMessage: string | null;
  bookedAt: Date;
};

export type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
};

const LEGAL_NOTE =
  'Cet e-mail constitue la confirmation de votre réservation sur un support durable (article L221-13 du Code de la consommation) : conservez-le, il récapitule le contrat conclu avec votre hôte.';

function describePaymentMethod(data: BookingConfirmationEmailData): string {
  const choice = data.paymentChoice?.toLowerCase() ?? null;
  if (choice === 'full') return 'Paiement intégral en ligne par carte bancaire (Stripe)';
  if (choice === 'split') return 'Acompte en ligne par carte bancaire (Stripe), solde en ligne avant l’arrivée';
  if (choice === 'cash') return 'Acompte en ligne par carte bancaire (Stripe), solde en espèces à l’arrivée';
  return data.paymentMethodLabel?.trim() || 'Paiement en ligne par carte bancaire (Stripe)';
}

function describeBalance(data: BookingConfirmationEmailData): string | null {
  const { balance, balanceMode, balanceDueDateISO } = data.amounts;
  if (balance <= 0 || balanceMode === 'none') return null;

  const amount = formatCurrency(balance, data.currency);
  const dueDate = parseIsoDate(balanceDueDateISO);
  if (balanceMode === 'cash') {
    return `${amount} à régler en espèces à votre hôte le jour de l’arrivée${dueDate ? ` (${formatShortDate(dueDate)})` : ''}.`;
  }
  return dueDate
    ? `${amount} à régler en ligne au plus tard le ${formatShortDate(dueDate)} ; vous recevrez les instructions de paiement par la messagerie de votre réservation.`
    : `${amount} à régler en ligne avant l’arrivée ; vous recevrez les instructions de paiement par la messagerie de votre réservation.`;
}

export function buildBookingConfirmationEmail(data: BookingConfirmationEmailData): RenderedEmail {
  const hostLabel = data.hostName?.trim() || 'votre hôte';
  const stay = formatStayRange(data.startDate, data.endDate, data.nights);
  const where = data.listingCity ? `${data.listingTitle} (${data.listingCity})` : data.listingTitle;
  const balanceLine = describeBalance(data);
  const policyLines = describeCancellationPolicy(data.cancellationSettings);
  const policySummary = summarizeCancellationPolicy(data.cancellationSettings);

  const stayRows: MailRow[] = [
    { label: 'Logement', value: where, strong: true },
    ...(data.hostName?.trim() ? [{ label: 'Hôte', value: hostLabel }] : []),
    { label: 'Séjour', value: stay },
    { label: 'Voyageurs', value: formatGuests(data.guests) },
    { label: 'Référence', value: data.reservationId },
    { label: 'Réservé le', value: formatShortDate(data.bookedAt) },
  ];

  const amountRows: MailRow[] = [
    { label: 'Total du séjour', value: formatCurrency(data.amounts.total, data.currency), strong: true },
    { label: 'Réglé aujourd’hui', value: formatCurrency(data.amounts.paidNow, data.currency) },
  ];
  if (balanceLine) {
    amountRows.push({ label: 'Reste à payer', value: balanceLine });
  } else {
    amountRows.push({ label: 'Reste à payer', value: 'Aucun, votre séjour est intégralement réglé.' });
  }
  amountRows.push({ label: 'Mode de paiement', value: describePaymentMethod(data) });

  const subject = `Réservation confirmée : ${data.listingTitle}, ${stay}`;
  const title = 'Votre réservation est confirmée';
  const intro = `${greet(data.guestName)} votre paiement a bien été reçu et vos dates sont réservées. Voici le récapitulatif de votre séjour chez ${hostLabel}.`;

  const html = renderDocument({
    title,
    preheader: `${data.listingTitle} — ${stay}`,
    body: [
      renderParagraph(intro),
      renderSectionTitle('Votre séjour'),
      renderRows(stayRows),
      renderSectionTitle('Montants'),
      renderRows(amountRows),
      renderSectionTitle('Guide d’arrivée et messagerie'),
      renderParagraph(
        'Votre guide d’arrivée rassemble les informations pratiques de votre hôte (accès, horaires, règles du logement) et la messagerie pour le contacter directement. Il se complète à l’approche de votre arrivée.',
      ),
      renderButton('Ouvrir mon guide d’arrivée', data.guideUrl),
      renderParagraph(
        'Vous pouvez aussi retrouver à tout moment votre confirmation, le détail des montants et, si besoin, annuler votre réservation depuis cette page :',
        { muted: true },
      ),
      renderButton('Voir ma confirmation', data.confirmationUrl),
      renderNotice('Conservez ces liens : ils sont personnels et donnent accès à votre réservation sans compte.'),
      renderSectionTitle(`Conditions d’annulation (${policySummary})`),
      renderList(policyLines),
      renderParagraph(
        'Toute annulation se fait depuis votre page de confirmation. Les remboursements éventuels sont émis sur le moyen de paiement utilisé et apparaissent généralement sous 5 à 10 jours ouvrés.',
        { muted: true },
      ),
      ...(data.travellerMessage
        ? [renderSectionTitle('Votre message à l’hôte'), renderParagraph(data.travellerMessage, { muted: true })]
        : []),
    ],
    legalNote: LEGAL_NOTE,
  });

  const text = renderPlainText(
    title,
    [
      intro,
      `VOTRE SÉJOUR\n${textRows(stayRows)}`,
      `MONTANTS\n${textRows(amountRows)}`,
      `GUIDE D’ARRIVÉE ET MESSAGERIE\nVotre guide d’arrivée rassemble les informations pratiques de votre hôte et la messagerie pour le contacter : ${data.guideUrl}`,
      `VOTRE CONFIRMATION\nRécapitulatif, montants et annulation : ${data.confirmationUrl}\nConservez ces liens : ils sont personnels et donnent accès à votre réservation sans compte.`,
      `CONDITIONS D’ANNULATION (${policySummary})\n${textList(policyLines)}\nToute annulation se fait depuis votre page de confirmation. Les remboursements éventuels sont émis sur le moyen de paiement utilisé et apparaissent généralement sous 5 à 10 jours ouvrés.`,
      ...(data.travellerMessage ? [`VOTRE MESSAGE À L’HÔTE\n${data.travellerMessage}`] : []),
    ],
    LEGAL_NOTE,
  );

  return { subject, text, html };
}
