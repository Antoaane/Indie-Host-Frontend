export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 4000),
    apiPrefix: process.env.API_PREFIX ?? 'v1',
    corsOrigins: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  },
  database: {
    url: process.env.DATABASE_URL ?? '',
  },
  auth: {
    clerkIssuer: process.env.CLERK_ISSUER ?? '',
    clerkAudience: process.env.CLERK_AUDIENCE ?? '',
    clerkJwksUrl: process.env.CLERK_JWKS_URL ?? '',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    platformFeeBps: Number(process.env.STRIPE_CONNECT_PLATFORM_FEE_BPS ?? 0),
    defaultApplicationFeeBps: Number(process.env.STRIPE_CONNECT_DEFAULT_APPLICATION_FEE_BPS ?? 0),
  },
  calendar: {
    prodId: process.env.ICAL_EXPORT_DEFAULT_PRODID ?? 'IndieHost//Calendar//FR',
  },
})
