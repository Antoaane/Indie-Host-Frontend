import 'dotenv/config';

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(50 * 1024 * 1024),
  API_PREFIX: z.string().trim().min(1).default('v1'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGINS: z.string().default('http://localhost:5179,http://localhost:3000'),
  DATABASE_URL: z.string().min(1),
  CLERK_JWKS_URL: z.string().trim().optional().default(''),
  CLERK_ISSUER: z.string().trim().optional().default(''),
  CLERK_AUDIENCE: z.string().trim().optional().default(''),
  STRIPE_SECRET_KEY: z.string().trim().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().trim().optional().default(''),
  STRIPE_CONNECT_PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(10000).default(0),
  STRIPE_CONNECT_DEFAULT_APPLICATION_FEE_BPS: z.coerce.number().int().min(0).max(10000).default(0),
  STRIPE_BILLING_PRICE_INDIEHOST: z.string().trim().optional().default(''),
  STRIPE_BILLING_PRICE_SUPERHOST: z.string().trim().optional().default(''),
  STRIPE_BILLING_PRICE_MEGAHOST: z.string().trim().optional().default(''),
  ICAL_EXPORT_DEFAULT_PRODID: z.string().trim().min(1).default('IndieHost//Calendar//FR'),
});

const parsed = envSchema.safeParse(process.env);

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
