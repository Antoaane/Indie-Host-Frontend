import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import Fastify from 'fastify';
import { ZodError } from 'zod';

import { env } from './config/env.js';
import { arrivalPlugin } from './domains/arrival/arrival.plugin.js';
import { bookingsPlugin } from './domains/bookings/bookings.plugin.js';
import { calendarPlugin } from './domains/calendar/calendar.plugin.js';
import { grandiPlugin } from './domains/grandi/grandi.plugin.js';
import { listingsPlugin } from './domains/listings/listings.plugin.js';
import { mediasPlugin } from './domains/medias/medias.plugin.js';
import { messagingPlugin } from './domains/messaging/messaging.plugin.js';
import { paymentsPlugin } from './domains/payments/payments.plugin.js';
import { usersPlugin } from './domains/users/users.plugin.js';
import { authPlugin } from './plugins/auth.js';
import { prismaPlugin } from './plugins/prisma.js';

function isOriginAllowed(origin: string, allowedOrigins: readonly string[]): boolean {
  if (allowedOrigins.includes(origin)) return true;

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  for (const allowedOrigin of allowedOrigins) {
    if (!allowedOrigin.includes('*')) continue;

    let allowedUrl: URL;
    try {
      allowedUrl = new URL(allowedOrigin);
    } catch {
      continue;
    }

    if (!allowedUrl.hostname.startsWith('*.')) continue;
    if (originUrl.protocol !== allowedUrl.protocol) continue;
    if (originUrl.port !== allowedUrl.port) continue;

    const baseHost = allowedUrl.hostname.slice(2);
    if (!baseHost) continue;
    if (!originUrl.hostname.endsWith(`.${baseHost}`)) continue;

    const subdomainPart = originUrl.hostname.slice(0, -(baseHost.length + 1));
    if (!subdomainPart || subdomainPart.includes('..')) continue;

    return true;
  }

  return false;
}

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
    bodyLimit: env.API_BODY_LIMIT_BYTES,
  });

  await app.register(sensible);

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (isOriginAllowed(origin, env.CORS_ORIGINS)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS'), false);
    },
    credentials: false,
  });

  await app.register(prismaPlugin);
  await app.register(authPlugin);

  app.get('/health', async () => ({
    status: 'ok',
    service: 'indiehost-api',
    timestamp: new Date().toISOString(),
  }));

  await app.register(async (v1) => {
    await v1.register(usersPlugin);
    await v1.register(listingsPlugin);
    await v1.register(bookingsPlugin);
    await v1.register(mediasPlugin);
    await v1.register(arrivalPlugin);
    await v1.register(messagingPlugin);
    await v1.register(paymentsPlugin);
    await v1.register(calendarPlugin);
    await v1.register(grandiPlugin);
  }, {
    prefix: `/${env.API_PREFIX.replace(/^\/+/, '')}`,
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      reply.code(400).send({
        message: 'Invalid request payload.',
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }

    request.log.error({ err: error }, 'Unhandled request error');

    if (reply.sent) return;

    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    const safeMessage = statusCode >= 500
      ? 'Internal server error.'
      : (error instanceof Error ? error.message : 'Request failed.');
    const errorCode = (error as { code?: unknown }).code;
    const errorDetails = (error as { details?: unknown }).details;

    reply.code(statusCode).send({
      message: safeMessage,
      ...(statusCode < 500 && typeof errorCode === 'string' ? { code: errorCode } : {}),
      ...(statusCode < 500 && errorDetails !== undefined ? { details: errorDetails } : {}),
    });
  });

  return app;
}
