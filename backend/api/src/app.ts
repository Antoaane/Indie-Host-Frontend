import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import Fastify from 'fastify';
import { ZodError } from 'zod';

import { env } from './config/env.js';
import { aiPlugin } from './domains/ai/ai.plugin.js';
import { arrivalPlugin } from './domains/arrival/arrival.plugin.js';
import { bookingsPlugin } from './domains/bookings/bookings.plugin.js';
import { calendarPlugin } from './domains/calendar/calendar.plugin.js';
import { importsPlugin } from './domains/imports/imports.plugin.js';
import { listingsPlugin } from './domains/listings/listings.plugin.js';
import { mediasPlugin } from './domains/medias/medias.plugin.js';
import { messagingPlugin } from './domains/messaging/messaging.plugin.js';
import { notificationsPlugin } from './domains/notifications/notifications.plugin.js';
import { paymentsPlugin } from './domains/payments/payments.plugin.js';
import { privacyPlugin } from './domains/privacy/privacy.plugin.js';
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

// Les URL journalisées ne doivent pas révéler les secrets qu'elles transportent : jetons passés en
// `?token=` et clés de guide d'arrivée `rg.…` (segment de chemin ou paramètre).
export function maskSensitiveUrl(url: string | undefined): string | undefined {
  if (typeof url !== 'string') return url;
  return url
    .replace(/([?&](?:token|key|guideKey|secret)=)[^&#]*/gi, '$1[masqué]')
    .replace(/rg\.[A-Za-z0-9._~-]+/g, 'rg.[masqué]');
}

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
        censor: '[masqué]',
      },
      serializers: {
        req(request) {
          return {
            method: request.method,
            url: maskSensitiveUrl(request.url),
            host: request.host,
            remoteAddress: request.ip,
          };
        },
      },
    },
    bodyLimit: env.API_BODY_LIMIT_BYTES,
  });

  // Fastify fige le gestionnaire d'erreurs de chaque route à son enregistrement : il doit être
  // déclaré avant les plugins, sinon les routes gardent celui par défaut, qui renvoie au client
  // le message brut des erreurs 500.
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

  await app.register(sensible);

  await app.register(cors, {
    // Origine refusée : aucun en-tête CORS n'est renvoyé et le navigateur bloque la réponse.
    origin: (origin, callback) => {
      callback(null, !origin || isOriginAllowed(origin, env.CORS_ORIGINS));
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
    await v1.register(aiPlugin);
    await v1.register(usersPlugin);
    await v1.register(privacyPlugin);
    await v1.register(listingsPlugin);
    await v1.register(bookingsPlugin);
    await v1.register(mediasPlugin);
    await v1.register(arrivalPlugin);
    await v1.register(messagingPlugin);
    await v1.register(paymentsPlugin);
    await v1.register(calendarPlugin);
    await v1.register(importsPlugin);
    await v1.register(notificationsPlugin);
  }, {
    prefix: `/${env.API_PREFIX.replace(/^\/+/, '')}`,
  });

  return app;
}
