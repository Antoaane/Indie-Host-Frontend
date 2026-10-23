import 'dotenv/config';

import fs from 'node:fs';
import { z } from 'zod';

const SECRET_FALLBACK_KEYS = [
  'DATABASE_URL',
  'IMAGEKIT_API_KEY',
  'CLERK_SECRET_KEY',
  'STRIPE_SECRET_KEY',
  'SMTP_PASSWORD',
] as const;

type SecretFallbackKey = (typeof SECRET_FALLBACK_KEYS)[number];

function readSecretFile(path?: string): string | undefined {
  if (!path?.trim()) return undefined;

  try {
    const value = fs.readFileSync(path, 'utf-8').trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

function readEnvValue(name: SecretFallbackKey): string | undefined {
  const direct = process.env[name]?.trim();
  if (direct) return direct;

  return readSecretFile(process.env[`${name}_FILE`]);
}

function resolveEnvWithSecretFallback(): NodeJS.ProcessEnv {
  const next = { ...process.env };

  for (const key of SECRET_FALLBACK_KEYS) {
    const value = readEnvValue(key);
    if (value !== undefined) next[key] = value;
  }

  return next;
}

const DEFAULT_BOOKING_GUIDE_ACCESS_SECRET = 'indiehost_booking_guide_secret';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(50 * 1024 * 1024),
  API_PREFIX: z.string().trim().min(1).default('v1'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGINS: z.string().default('http://localhost:5179,http://localhost:3000'),
  DATABASE_URL: z.string().min(1),
  IMAGEKIT_API_KEY: z.string().trim().optional().default(''),
  IMAGEKIT_ENDPOINT: z.string().trim().optional().default(''),
  IMAGEKIT_UPLOAD_DEFAULT_FOLDER: z.string().trim().optional().default('/indiehost/listings'),
  CLERK_JWKS_URL: z.string().trim().optional().default(''),
  CLERK_ISSUER: z.string().trim().optional().default(''),
  CLERK_AUDIENCE: z.string().trim().optional().default(''),
  CLERK_SECRET_KEY: z.string().trim().optional().default(''),
  // Secret de signature (Svix, `whsec_…`) du webhook Clerk `POST /webhooks/clerk` (événement
  // `user.deleted`). Vide : la route répond 503 et la suppression côté Clerk n'est pas répercutée.
  CLERK_WEBHOOK_SECRET: z.string().trim().optional().default(''),
  // Purge automatique des données (durées de la politique de confidentialité) : `false` pour la couper.
  RETENTION_PURGE_ENABLED: z
    .string()
    .trim()
    .optional()
    .default('true')
    .transform((value) => !['false', '0', 'no', 'off'].includes(value.toLowerCase())),
  // Emails (séparés par des virgules) qui obtiennent le rôle super_admin quelle que soit la métadonnée Clerk.
  SUPER_ADMIN_EMAILS: z.string().trim().optional().default(''),
  STRIPE_SECRET_KEY: z.string().trim().optional().default(''),
  STRIPE_CONNECT_PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(10000).default(0),
  STRIPE_CONNECT_DEFAULT_APPLICATION_FEE_BPS: z.coerce.number().int().min(0).max(10000).default(0),
  // Secret de signature du webhook Stripe (whsec_…) ; vide → POST /payments/stripe/webhook répond 503.
  STRIPE_WEBHOOK_SECRET: z.string().trim().optional().default(''),
  ICAL_EXPORT_DEFAULT_PRODID: z.string().trim().min(1).default('IndieHost//Calendar//FR'),
  // Valeur par défaut tolérée en dev/test seulement : en production, le secret doit être fourni
  // (vérifié plus bas), sinon n'importe qui pourrait forger une clé de guide d'arrivée.
  BOOKING_GUIDE_ACCESS_SECRET: z.string().trim().min(1).default(DEFAULT_BOOKING_GUIDE_ACCESS_SECRET),
  ICAL_SYNC_THROTTLE_SECONDS: z.coerce.number().int().min(60).default(300),
  ICAL_SYNC_FETCH_TIMEOUT_MS: z.coerce.number().int().min(1000).default(15000),
  PUBLIC_LISTING_ROOT_DOMAIN: z.string().trim().min(1).default('indiehost.fr'),
  // Domaines personnalisés des hôtes : cible des enregistrements A / CNAME et fichier lu par certbot.
  CUSTOM_DOMAIN_TARGET_IPV4: z.string().trim().optional().default(''),
  CUSTOM_DOMAIN_CNAME_TARGET: z.string().trim().optional().default(''),
  CUSTOM_DOMAINS_FILE: z.string().trim().optional().default(''),
  GROQ_API_KEY: z.string().trim().optional().default(''),
  // Microservice de scraping, joignable uniquement sur le réseau Docker (plus exposé par nginx).
  SCRAPING_SERVICE_URL: z.string().trim().url().default('http://scraping:8000'),
  // E-mails transactionnels (confirmation et annulation de réservation, `lib/mailer.ts`). Tout est
  // optionnel : sans SMTP_URL ni SMTP_HOST, aucun e-mail n'est envoyé et l'API continue normalement.
  // SMTP_URL (ex. smtps://user:pass@smtp.gmail.com:465) prime sur les variables séparées.
  SMTP_URL: z.string().trim().optional().default(''),
  SMTP_HOST: z.string().trim().optional().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  // `true` = TLS implicite (port 465) ; `false` = STARTTLS (port 587).
  SMTP_SECURE: z
    .string()
    .trim()
    .optional()
    .default('true')
    .transform((value) => !['false', '0', 'no', 'off'].includes(value.toLowerCase())),
  SMTP_USER: z.string().trim().optional().default(''),
  // Mot de passe SMTP : variable directe ou secret Docker via SMTP_PASSWORD_FILE (voir SECRET_FALLBACK_KEYS).
  SMTP_PASSWORD: z.string().optional().default(''),
  MAIL_FROM: z.string().trim().min(1).default('IndieHost <no-reply@indiehost.fr>'),
  MAIL_REPLY_TO: z.string().trim().optional().default(''),
  // Origine publique du site (liens des e-mails : page de confirmation, guide d'arrivée).
  // Même variable que celle de nginx dans le .env racine ; vide → déduite de PUBLIC_LISTING_ROOT_DOMAIN.
  BASE_URL: z.string().trim().optional().default(''),
});

const parsed = envSchema.safeParse(resolveEnvWithSecretFallback());

if (!parsed.success) {
  const formatted = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  throw new Error(`Invalid environment variables:\n${formatted}`);
}

const raw = parsed.data;

if (
  raw.NODE_ENV === 'production' &&
  (raw.BOOKING_GUIDE_ACCESS_SECRET === DEFAULT_BOOKING_GUIDE_ACCESS_SECRET ||
    raw.BOOKING_GUIDE_ACCESS_SECRET.length < 16)
) {
  throw new Error(
    'Invalid environment variables:\nBOOKING_GUIDE_ACCESS_SECRET: must be set to a custom value of at least 16 characters when NODE_ENV=production',
  );
}

const corsOrigins = raw.CORS_ORIGINS
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const clerkAudience = raw.CLERK_AUDIENCE
  ? raw.CLERK_AUDIENCE.split(',').map((value) => value.trim()).filter(Boolean)
  : [];

export const env = {
  ...raw,
  CORS_ORIGINS: corsOrigins,
  CLERK_AUDIENCE: clerkAudience,
} as const;

export type AppEnv = typeof env;
