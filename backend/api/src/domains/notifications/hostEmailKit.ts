// Briques des e-mails aux hôtes : un message est une suite de blocs, rendus à la fois en HTML et en
// texte, pour que les deux versions disent toujours la même chose.

import type { BalanceMode, RenderedEmail } from './bookingConfirmation.js';
import {
  formatCurrency,
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

export type HostEmailBlock =
  | { kind: 'paragraph'; text: string; muted?: boolean }
  | { kind: 'rows'; rows: MailRow[] }
  | { kind: 'list'; items: string[] }
  | { kind: 'notice'; text: string }
  | { kind: 'button'; label: string; href: string }
  | { kind: 'section'; title: string };

export type HostEmailInput = {
  subject: string;
  title: string;
  preheader: string;
  blocks: HostEmailBlock[];
  /** Phrase du pied de page ; par défaut, la raison de l'envoi. */
  legalNote?: string;
  /** Rappels seulement : les e-mails liés à une réservation ou à un paiement ne se refusent pas. */
  unsubscribeUrl?: string | null;
};

const DEFAULT_LEGAL_NOTE = 'Vous recevez cet e-mail parce que vous avez un compte hôte IndieHost.';

function blockToHtml(block: HostEmailBlock): string {
  switch (block.kind) {
    case 'paragraph':
      return renderParagraph(block.text, { muted: block.muted });
    case 'rows':
      return renderRows(block.rows);
    case 'list':
      return renderList(block.items);
    case 'notice':
      return renderNotice(block.text);
    case 'button':
      return renderButton(block.label, block.href);
    case 'section':
      return renderSectionTitle(block.title);
  }
}

function blockToText(block: HostEmailBlock): string {
  switch (block.kind) {
    case 'paragraph':
    case 'notice':
      return block.text;
    case 'rows':
      return textRows(block.rows);
    case 'list':
      return textList(block.items);
    case 'button':
      return `${block.label} : ${block.href}`;
    case 'section':
      return block.title.toUpperCase();
  }
}

export function renderHostEmail(input: HostEmailInput): RenderedEmail {
  const legalNote = input.legalNote ?? DEFAULT_LEGAL_NOTE;
  const html = renderDocument({
    title: input.title,
    preheader: input.preheader,
    body: input.blocks.map(blockToHtml),
    legalNote,
    audience: 'host',
    unsubscribeUrl: input.unsubscribeUrl,
  });
  const text = renderPlainText(input.title, input.blocks.map(blockToText), legalNote, {
    audience: 'host',
    unsubscribeUrl: input.unsubscribeUrl,
  });
  return { subject: input.subject, html, text };
}

const DAY_MONTH = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const DAY_MONTH_YEAR = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** « 12 – 15 mars » pour un objet d'e-mail (l'année n'apparaît que si elle change). */
export function formatShortRange(start: Date, end: Date): string {
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();
  if (sameMonth) return `${start.getUTCDate()} – ${DAY_MONTH.format(end)}`;
  if (sameYear) return `${DAY_MONTH.format(start)} – ${DAY_MONTH.format(end)}`;
  return `${DAY_MONTH_YEAR.format(start)} – ${DAY_MONTH_YEAR.format(end)}`;
}

/** Montant en centimes → « 1 240,00 € ». */
export function formatMinor(amountMinor: number, currency: string): string {
  return formatCurrency(Math.max(0, amountMinor) / 100, currency);
}

export function describeBalance(balance: number, mode: BalanceMode, currency: string, dueDate: string | null): string | null {
  if (balance <= 0 || mode === 'none') return null;
  const amount = formatCurrency(balance, currency);
  if (mode === 'cash') return `${amount}, en espèces à l’arrivée`;
  return dueDate ? `${amount}, prélevé en ligne le ${dueDate}` : `${amount}, prélevé en ligne avant l’arrivée`;
}
