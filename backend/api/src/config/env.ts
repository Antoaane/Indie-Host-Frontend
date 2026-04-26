import 'dotenv/config';

import fs from 'node:fs';
import { z } from 'zod';

const SECRET_FALLBACK_KEYS = [
  'DATABASE_URL',
  'IMAGEKIT_API_KEY',
  'CLERK_SECRET_KEY',
  'STRIPE_SECRET_KEY',
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
  STRIPE_SECRET_KEY: z.string().trim().optional().default(''),
  STRIPE_CONNECT_PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(10000).default(0),
  STRIPE_CONNECT_DEFAULT_APPLICATION_FEE_BPS: z.coerce.number().int().min(0).max(10000).default(0),
  ICAL_EXPORT_DEFAULT_PRODID: z.string().trim().min(1).default('IndieHost//Calendar//FR'),
  BOOKING_GUIDE_ACCESS_SECRET: z.string().trim().min(1).default('indiehost_booking_guide_secret'),
  ICAL_SYNC_THROTTLE_SECONDS: z.coerce.number().int().min(60).default(300),
  ICAL_SYNC_FETCH_TIMEOUT_MS: z.coerce.number().int().min(1000).default(15000),
  PUBLIC_LISTING_ROOT_DOMAIN: z.string().trim().min(1).default('indiehost.fr'),
});

const parsed = envSchema.safeParse(resolveEnvWithSecretFallback());

if (!parsed.success) {
  const formatted = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  throw new Error(`Invalid environment variables:\n${formatted}`);
}

const raw = parsed.data;

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
