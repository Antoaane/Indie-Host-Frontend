import * as Joi from 'joi'

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(4000),
  API_PREFIX: Joi.string().default('v1'),
  CORS_ORIGINS: Joi.string().allow('').optional(),

  DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).required(),

  CLERK_JWKS_URL: Joi.string().uri().allow('').optional(),
  CLERK_ISSUER: Joi.string().uri().allow('').optional(),
  CLERK_AUDIENCE: Joi.string().allow('').optional(),

  STRIPE_SECRET_KEY: Joi.string().allow('').optional(),
  STRIPE_WEBHOOK_SECRET: Joi.string().allow('').optional(),
  STRIPE_CONNECT_PLATFORM_FEE_BPS: Joi.number().min(0).max(10000).default(0),
  STRIPE_CONNECT_DEFAULT_APPLICATION_FEE_BPS: Joi.number().min(0).max(10000).default(0),

  ICAL_EXPORT_DEFAULT_PRODID: Joi.string().default('IndieHost//Calendar//FR'),
})
