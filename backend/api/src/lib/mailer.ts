import nodemailer, { type Transporter } from 'nodemailer';

import { env } from '../config/env.js';

/**
 * Enveloppe minimale autour de nodemailer.
 *
 * - Sans configuration SMTP (`SMTP_URL` ou `SMTP_HOST` vides), `isMailerConfigured()` renvoie `false`,
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
  /** Contexte ajouté aux logs (jamais envoyé) : identifiants de réservation, d'annonce… */
  context?: Record<string, unknown>;
};

export type SendMailResult =
  | { ok: true; skipped: false; messageId: string | null }
  | { ok: false; skipped: true; reason: 'not_configured' | 'no_recipient' }
  | { ok: false; skipped: false; reason: 'send_failed' };

const SEND_TIMEOUT_MS = 20_000;

let transporter: Transporter | null = null;
let warnedNotConfigured = false;

export function isMailerConfigured(): boolean {
  return Boolean(env.SMTP_URL || env.SMTP_HOST);
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

export async function sendMail(message: MailMessage): Promise<SendMailResult> {
  const context = message.context ?? {};

  if (!isMailerConfigured()) {
    if (!warnedNotConfigured) {
      warnedNotConfigured = true;
      console.warn('[mailer] E-mails désactivés : SMTP non configuré (SMTP_URL ou SMTP_HOST manquant).');
    }
    return { ok: false, skipped: true, reason: 'not_configured' };
  }

  const recipients = normalizeRecipients(message.to);
  if (recipients.length === 0) {
    console.warn('[mailer] e-mail ignoré : aucun destinataire valide', context);
    return { ok: false, skipped: true, reason: 'no_recipient' };
  }

  try {
    const info = await getTransporter().sendMail({
      from: env.MAIL_FROM,
      to: recipients,
      replyTo: message.replyTo ?? (env.MAIL_REPLY_TO || undefined),
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    const messageId = typeof info?.messageId === 'string' ? info.messageId : null;
    console.info('[mailer] e-mail envoyé', { ...context, to: recipients, messageId });
    return { ok: true, skipped: false, messageId };
  } catch (error) {
    console.error('[mailer] échec d\'envoi', { ...context, to: recipients, error });
    return { ok: false, skipped: false, reason: 'send_failed' };
  }
}

/** Vérifie la connexion SMTP (utilisé par les outils de diagnostic, jamais au démarrage de l'API). */
export async function verifyMailer(): Promise<boolean> {
  if (!isMailerConfigured()) return false;
  try {
    await getTransporter().verify();
    return true;
  } catch (error) {
    console.error('[mailer] vérification SMTP échouée', { error });
    return false;
  }
}
