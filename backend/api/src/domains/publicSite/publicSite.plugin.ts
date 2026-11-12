import type { FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';

import { env } from '../../config/env.js';
import { renderSitemap } from './html.js';
import { PublicSiteService } from './publicSite.service.js';

const listingIdParamsSchema = z.object({ listingId: z.string().trim().min(1).max(200) });

function readHeader(request: FastifyRequest, name: string): string {
  const value = request.headers[name];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

function rootDomain(): string {
  return env.PUBLIC_LISTING_ROOT_DOMAIN.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^\*\./, '').replace(/\/+$/, '');
}

export const publicSitePlugin = fp(async (fastify) => {
  const service = new PublicSiteService(fastify.prisma);

  /*
   * Pages des sites d'hôtes, appelée par nginx (`nginx/proxy-locations.conf`, `@public_site`) avec
   * l'hôte et l'adresse demandés. « Délégué » : `X-Accel-Redirect` vers `/__frontend…`, nginx sert
   * alors la page du site Vue comme avant.
   */
  fastify.get('/public-site/page', async (request, reply) => {
    const host = readHeader(request, 'x-forwarded-host') || readHeader(request, 'host');
    const uri = readHeader(request, 'x-original-uri') || '/';
    const proto = readHeader(request, 'x-forwarded-proto') || (env.NODE_ENV === 'production' ? 'https' : 'http');

    let result;
    try {
      result = await service.handle({ host, uri, proto });
    } catch (error) {
      request.log.error({ err: error, host, uri }, '[public-site] render failed');
      result = { type: 'delegate' as const };
    }

    if (result.type === 'redirect') {
      reply.header('cache-control', 'no-cache').redirect(result.location, 301);
      return;
    }
    if (result.type === 'delegate') {
      const target = uri.startsWith('/') ? uri : `/${uri}`;
      reply.header('x-accel-redirect', `/__frontend${target}`).header('x-public-site', 'delegate').code(200).send('');
      return;
    }
    reply
      .code(result.status)
      .header('content-type', result.contentType)
      .header('cache-control', 'no-cache')
      .send(result.body);
  });

  /**
   * Sitemap des annonces servies par indiehost.fr et ses sous-domaines. Un domaine relié a son propre
   * sitemap (`https://<domaine>/sitemap.xml`), annoncé par son `robots.txt`.
   */
  fastify.get('/listings/sitemap.xml', async (_request, reply) => {
    const root = rootDomain();
    const sites = await service.collectSites('https');
    const entries = [...sites.entries()]
      .filter(([host]) => host === root || host.endsWith(`.${root}`))
      .flatMap(([, site]) => site.entries);
    reply.type('application/xml; charset=utf-8').header('cache-control', 'no-cache').send(renderSitemap(entries));
  });

  /** Nom du site et pied de page d'une annonce (pages des logements : celui de leur page principale). */
  fastify.get('/listings/:listingId/site', async (request, reply) => {
    const params = listingIdParamsSchema.parse(request.params);
    const listing = await service.loadListing(params.listingId);
    if (!listing || listing.status === 'deleted') {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }
    const site = await service.resolveSite(listing);
    reply.send({
      listingId: listing.id,
      siteName: site.siteName,
      footer: site.footer,
      hubListingId: site.hub?.id ?? null,
    });
  });
});
