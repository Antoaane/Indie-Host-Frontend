import nodemailer, { type Transporter } from 'nodemailer';

import { env } from '../config/env.js';

/**
 * Envoi des e-mails automatiques, par l'API de Brevo (`BREVO_API_KEY`) ou à défaut en SMTP.
 *
 * - Sans Brevo ni SMTP (`SMTP_URL` ou `SMTP_HOST` vides), `isMailerConfigured()` renvoie `false`,
 *   `sendMail()` journalise un avertissement une seule fois par démarrage et renvoie `{ skipped: true }`.
 * - Un échec d'envoi est journalisé en `error` avec le contexte fourni (id de réservation…) et renvoyé
 *   sous forme de résultat : `sendMail()` ne lève jamais, un e-mail ne doit jamais faire échouer une
 *   réservation.
 */

export type MailMessage = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  /** En-têtes ajoutés au message (ex. `List-Unsubscribe`). */
  headers?: Record<string, string>;
  /** Catégories visibles dans les statistiques de Brevo (ignorées en SMTP). */
  tags?: string[];
  /** Contexte ajouté aux logs (jamais envoyé) : identifiants de réservation, d'annonce… */
  context?: Record<string, unknown>;
};

export type SendMailResult =
  | { ok: true; skipped: false; messageId: string | null }
  | { ok: false; skipped: true; reason: 'not_configured' | 'no_recipient' }
  | { ok: false; skipped: false; reason: 'send_failed' };

const SEND_TIMEOUT_MS = 20_000;
const BREVO_API_BASE_URL = 'https://api.brevo.com/v3';

let transporter: Transporter | null = null;
let warnedNotConfigured = false;

function usesBrevo(): boolean {
  return Boolean(env.BREVO_API_KEY);
}

export function isMailerConfigured(): boolean {
  return Boolean(env.BREVO_API_KEY || env.SMTP_URL || env.SMTP_HOST);
}

/** Origine publique du site, pour les liens absolus des e-mails. */
export function resolvePublicBaseUrl(preferred?: string | null): string {
  const candidate = preferred?.trim() || env.BASE_URL;
  if (candidate) return candidate.replace(/\/+$/, '');

  const root = env.PUBLIC_LISTING_ROOT_DOMAIN;
  const isLocal = root === 'localhost' || root.endsWith('.localhost') || root.endsWith('.local');
  return `${isLocal ? 'http' : 'https'}://${root}`;
}

function createTransporter(): Transporter {
  if (env.SMTP_URL) {
    return nodemailer.createTransport(env.SMTP_URL, {
      connectionTimeout: SEND_TIMEOUT_MS,
      greetingTimeout: SEND_TIMEOUT_MS,
      socketTimeout: SEND_TIMEOUT_MS,
    });
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    connectionTimeout: SEND_TIMEOUT_MS,
    greetingTimeout: SEND_TIMEOUT_MS,
    socketTimeout: SEND_TIMEOUT_MS,
  });
}

function getTransporter(): Transporter {
  if (!transporter) transporter = createTransporter();
  return transporter;
}

function normalizeRecipients(to: string | string[]): string[] {
  const list = Array.isArray(to) ? to : [to];
  return list.map((value) => value.trim()).filter((value) => value.includes('@'));
}

/** « IndieHost <no-reply@mail.indiehost.fr> » → { name, email } (format attendu par Brevo). */
function parseAddress(raw: string): { email: string; name?: string } {
  const match = raw.trim().match(/^(.*)<([^>]+)>$/);
  if (!match) return { email: raw.trim() };
  const name = (match[1] ?? '').trim().replace(/^"|"$/g, '');
  const email = (match[2] ?? '').trim();
  return name ? { email, name } : { email };
}

async function sendWithBrevo(message: MailMessage, recipients: string[], replyTo: string | undefined): Promise<string | null> {
  const response = await fetch(`${BREVO_API_BASE_URL}/smtp/email`, {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: parseAddress(env.MAIL_FROM),
      to: recipients.map((email) => ({ email })),
      ...(replyTo ? { replyTo: parseAddress(replyTo) } : {}),
      subject: message.subject,
      textContent: message.text,
      ...(message.html ? { htmlContent: message.html } : {}),
      ...(message.headers ? { headers: message.headers } : {}),
      ...(message.tags?.length ? { tags: message.tags } : {}),
    }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    // Le corps d'erreur de Brevo ({ code, message }) ne contient jamais la clé.
    throw new Error(`Brevo ${response.status}: ${String(payload?.code ?? '')} ${String(payload?.message ?? '')}`.trim());
  }
  return typeof payload?.messageId === 'string' ? payload.messageId : null;
}

async function sendWithSmtp(message: MailMessage, recipients: string[], replyTo: string | undefined): Promise<string | null> {
  const info = await getTransporter().sendMail({
    from: env.MAIL_FROM,
    to: recipients,
    replyTo,
    subject: message.subject,
    text: message.text,
    html: message.html,
    headers: message.headers,
  });
  return typeof info?.messageId === 'string' ? info.messageId : null;
}

export async function sendMail(message: MailMessage): Promise<SendMailResult> {
  const context = message.context ?? {};

  if (!isMailerConfigured()) {
    if (!warnedNotConfigured) {
      warnedNotConfigured = true;
      console.warn('[mailer] E-mails désactivés : ni BREVO_API_KEY ni SMTP (SMTP_URL ou SMTP_HOST) configuré.');
    }
    return { ok: false, skipped: true, reason: 'not_configured' };
  }

  const recipients = normalizeRecipients(message.to);
  if (recipients.length === 0) {
    console.warn('[mailer] e-mail ignoré : aucun destinataire valide', context);
    return { ok: false, skipped: true, reason: 'no_recipient' };
  }

  const replyTo = message.replyTo ?? (env.MAIL_REPLY_TO || undefined);
  const provider = usesBrevo() ? 'brevo' : 'smtp';

  try {
    const messageId = provider === 'brevo'
      ? await sendWithBrevo(message, recipients, replyTo)
      : await sendWithSmtp(message, recipients, replyTo);
    console.info('[mailer] e-mail envoyé', { ...context, provider, to: recipients, messageId });
    return { ok: true, skipped: false, messageId };
  } catch (error) {
    console.error('[mailer] échec d\'envoi', { ...context, provider, to: recipients, error });
    return { ok: false, skipped: false, reason: 'send_failed' };
  }
}

/** Vérifie la connexion au service d'envoi (outils de diagnostic, jamais au démarrage de l'API). */
export async function verifyMailer(): Promise<boolean> {
  if (!isMailerConfigured()) return false;
  try {
    if (usesBrevo()) {
      const response = await fetch(`${BREVO_API_BASE_URL}/account`, {
        headers: { 'api-key': env.BREVO_API_KEY, accept: 'application/json' },
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Brevo ${response.status}`);
      return true;
    }
    await getTransporter().verify();
    return true;
  } catch (error) {
    console.error('[mailer] vérification du service d’envoi échouée', { error });
    return false;
  }
}
