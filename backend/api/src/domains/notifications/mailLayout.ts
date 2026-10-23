// Briques communes aux e-mails transactionnels : échappement, formats français, gabarit HTML.
// Contraintes : aucune image externe, styles en ligne uniquement, couleurs lisibles en mode sombre
// (texte et fond toujours déclarés ensemble), version texte lisible seule.

export const LEGAL_ORIGIN = 'https://indiehost.fr';
export const LEGAL_LINKS = {
  travellerTerms: `${LEGAL_ORIGIN}/legal/cgu-voyageurs`,
  cancellation: `${LEGAL_ORIGIN}/legal/annulation-remboursement`,
  privacy: `${LEGAL_ORIGIN}/legal/confidentialite`,
  hostTerms: `${LEGAL_ORIGIN}/legal/cgv`,
} as const;

export const COMPANY_NAME = 'IndieHost SAS';

/** Adresse de réponse des e-mails aux hôtes : une réponse arrive au support. */
export const SUPPORT_EMAIL = 'contact@indiehost.fr';

/** Destinataire du message : le pied de page (liens légaux, réponse possible ou non) en dépend. */
export type MailAudience = 'guest' | 'host';

const COLORS = {
  page: '#f3f4f6',
  card: '#ffffff',
  text: '#1b1b1f',
  muted: '#5f6368',
  border: '#e3e5e8',
  accent: '#0063c9',
  accentText: '#ffffff',
  noticeBg: '#eef4fc',
  noticeText: '#163a63',
} as const;

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

const LONG_DATE = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const SHORT_DATE = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const DATE_TIME = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
});

/** « jeudi 12 mars 2026 » (les jours de séjour sont stockés à minuit UTC : on reste en UTC). */
export function formatLongDate(date: Date): string {
  return LONG_DATE.format(date);
}

/** « 12 mars 2026 ». */
export function formatShortDate(date: Date): string {
  return SHORT_DATE.format(date);
}

/** « 12 mars 2026 à 14:05 » (heure de Paris). */
export function formatDateTime(date: Date): string {
  return DATE_TIME.format(date);
}

/** « Bonjour Camille, » ou « Bonjour, » sans nom. */
export function greet(name: string | null | undefined): string {
  const safe = name?.trim();
  return safe ? `Bonjour ${safe},` : 'Bonjour,';
}

export function parseIsoDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count > 1 ? plural : singular}`;
}

/** « du jeudi 12 mars 2026 au dimanche 15 mars 2026, 3 nuits ». */
export function formatStayRange(start: Date, end: Date, nights: number): string {
  return `du ${formatLongDate(start)} au ${formatLongDate(end)}, ${pluralize(nights, 'nuit')}`;
}

export function formatCurrency(amount: number, currency: string): string {
  const safeCurrency = /^[a-z]{3}$/i.test(currency) ? currency.toUpperCase() : 'EUR';
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: safeCurrency }).format(safeAmount);
  } catch {
    return `${safeAmount.toFixed(2)} ${safeCurrency}`;
  }
}

export type GuestsBreakdown = {
  adults: number;
  children: number;
  infants: number;
  pets: number;
  pmr: number;
};

export function readGuestsBreakdown(raw: Record<string, unknown>): GuestsBreakdown {
  const read = (value: unknown): number => {
    const next = Number(value);
    return Number.isFinite(next) && next > 0 ? Math.trunc(next) : 0;
  };
  return {
    adults: read(raw.adults),
    children: read(raw.children),
    infants: read(raw.infants ?? raw.babies),
    pets: read(raw.pets ?? raw.animals),
    pmr: read(raw.pmr),
  };
}

/** « 2 adultes, 1 enfant, 1 bébé, 1 animal » (les voyageurs à mobilité réduite sont signalés à part). */
export function formatGuests(guests: GuestsBreakdown): string {
  const parts: string[] = [];
  if (guests.adults > 0) parts.push(pluralize(guests.adults, 'adulte'));
  if (guests.children > 0) parts.push(pluralize(guests.children, 'enfant'));
  if (guests.infants > 0) parts.push(pluralize(guests.infants, 'bébé'));
  if (guests.pets > 0) parts.push(pluralize(guests.pets, 'animal', 'animaux'));
  if (parts.length === 0) parts.push('1 voyageur');
  if (guests.pmr > 0) {
    parts.push(`dont ${pluralize(guests.pmr, 'personne')} à mobilité réduite`);
  }
  return parts.join(', ');
}

// --- Gabarit HTML ----------------------------------------------------------------------------

export type MailRow = { label: string; value: string; strong?: boolean };

export function renderRows(rows: MailRow[]): string {
  const cells = rows
    .map((row) => {
      const weight = row.strong ? 'font-weight:700;' : '';
      return `<tr>
  <td style="padding:8px 0;border-bottom:1px solid ${COLORS.border};color:${COLORS.muted};font-size:14px;vertical-align:top;width:44%;">${escapeHtml(row.label)}</td>
  <td style="padding:8px 0;border-bottom:1px solid ${COLORS.border};color:${COLORS.text};font-size:14px;vertical-align:top;${weight}">${escapeHtml(row.value)}</td>
</tr>`;
    })
    .join('\n');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${cells}</table>`;
}

export function renderSectionTitle(title: string): string {
  return `<h2 style="margin:28px 0 10px;font-size:16px;line-height:1.3;font-weight:700;color:${COLORS.text};">${escapeHtml(title)}</h2>`;
}

export function renderParagraph(text: string, options?: { muted?: boolean }): string {
  const color = options?.muted ? COLORS.muted : COLORS.text;
  return `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:${color};">${escapeHtml(text)}</p>`;
}

export function renderList(items: string[]): string {
  const lis = items
    .map((item) => `<li style="margin:0 0 6px;font-size:14px;line-height:1.5;color:${COLORS.text};">${escapeHtml(item)}</li>`)
    .join('');
  return `<ul style="margin:0 0 12px;padding-left:20px;">${lis}</ul>`;
}

export function renderButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 8px;">
  <tr>
    <td style="border-radius:8px;background:${COLORS.accent};">
      <a href="${escapeAttribute(href)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:${COLORS.accentText};text-decoration:none;border-radius:8px;background:${COLORS.accent};">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>
<p style="margin:0 0 12px;font-size:12px;line-height:1.5;color:${COLORS.muted};word-break:break-all;">Si le bouton ne fonctionne pas, copiez ce lien : <a href="${escapeAttribute(href)}" style="color:${COLORS.accent};">${escapeHtml(href)}</a></p>`;
}

export function renderNotice(text: string): string {
  return `<div style="margin:16px 0;padding:12px 14px;border-radius:8px;background:${COLORS.noticeBg};color:${COLORS.noticeText};font-size:14px;line-height:1.5;">${escapeHtml(text)}</div>`;
}

export function renderLink(label: string, href: string): string {
  return `<a href="${escapeAttribute(href)}" style="color:${COLORS.accent};">${escapeHtml(label)}</a>`;
}

export type MailDocument = {
  title: string;
  preheader: string;
  /** Fragments HTML déjà échappés, dans l'ordre. */
  body: string[];
  /** Phrase légale propre au message, sous les liens communs. */
  legalNote: string;
  /** `guest` par défaut. */
  audience?: MailAudience;
  /** Lien de désinscription des rappels (e-mails aux hôtes qui ne sont pas indispensables). */
  unsubscribeUrl?: string | null;
};

function renderFooter(document: MailDocument): string {
  if (document.audience === 'host') {
    const unsubscribe = document.unsubscribeUrl
      ? `<p style="margin:8px 0 0;">${renderLink('Ne plus recevoir ces rappels', document.unsubscribeUrl)}</p>`
      : '';
    return `<p style="margin:0 0 8px;">${escapeHtml(document.legalNote)}</p>
            <p style="margin:0;">Une question ? Répondez simplement à cet e-mail. ${escapeHtml(COMPANY_NAME)} · ${renderLink('Conditions générales', LEGAL_LINKS.hostTerms)} · ${renderLink('Confidentialité', LEGAL_LINKS.privacy)}</p>${unsubscribe}`;
  }

  return `<p style="margin:0 0 8px;">${escapeHtml(document.legalNote)}</p>
            <p style="margin:0 0 8px;">${escapeHtml(COMPANY_NAME)} · ${renderLink('Conditions d’utilisation et de réservation (voyageurs)', LEGAL_LINKS.travellerTerms)} · ${renderLink('Annulation et remboursement', LEGAL_LINKS.cancellation)} · ${renderLink('Confidentialité', LEGAL_LINKS.privacy)}</p>
            <p style="margin:0;">IndieHost met en relation hôtes et voyageurs sans commission : le contrat d’hébergement est conclu entre vous et l’hôte. Cet e-mail a été envoyé automatiquement, merci de ne pas y répondre.</p>`;
}

export function renderDocument(document: MailDocument): string {
  const body = document.body.join('\n');
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(document.title)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.page};color:${COLORS.text};font-family:${FONT_STACK};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(document.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.page};">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${COLORS.card};color:${COLORS.text};border-radius:12px;border:1px solid ${COLORS.border};">
        <tr>
          <td style="padding:28px 28px 8px;">
            <p style="margin:0 0 18px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;color:${COLORS.accent};">IndieHost</p>
            <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;color:${COLORS.text};">${escapeHtml(document.title)}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:0 28px 24px;">
${body}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 28px 26px;border-top:1px solid ${COLORS.border};font-size:12px;line-height:1.6;color:${COLORS.muted};">
            ${renderFooter(document)}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** Version texte : titre, blocs séparés par des lignes vides, pied légal commun. */
export function renderPlainText(
  title: string,
  blocks: string[],
  legalNote: string,
  options?: { audience?: MailAudience; unsubscribeUrl?: string | null },
): string {
  const footer = options?.audience === 'host'
    ? [
        `Une question ? Répondez simplement à cet e-mail. ${COMPANY_NAME} · Conditions générales : ${LEGAL_LINKS.hostTerms}`,
        ...(options.unsubscribeUrl ? [`Ne plus recevoir ces rappels : ${options.unsubscribeUrl}`] : []),
      ]
    : [
        `${COMPANY_NAME} · Conditions voyageurs : ${LEGAL_LINKS.travellerTerms} · Annulation et remboursement : ${LEGAL_LINKS.cancellation}`,
        'IndieHost met en relation hôtes et voyageurs sans commission : le contrat d’hébergement est conclu entre vous et l’hôte. E-mail automatique, merci de ne pas y répondre.',
      ];

  return [
    `IndieHost — ${title}`,
    '',
    ...blocks.flatMap((block) => [block, '']),
    '--',
    legalNote,
    ...footer,
  ].join('\n');
}

export function textRows(rows: MailRow[]): string {
  return rows.map((row) => `${row.label} : ${row.value}`).join('\n');
}

export function textList(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}
