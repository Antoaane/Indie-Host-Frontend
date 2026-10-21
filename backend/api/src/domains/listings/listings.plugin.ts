import fp from 'fastify-plugin';

import { asObject } from '../../lib/json.js';
import { ListingsService } from './listings.service.js';
import {
  createListingSchema,
  listingDomainAvailabilitySchema,
  listingIdParamsSchema,
  listingResourceParamsSchema,
  patchListingResourceSchema,
  resolveListingHostnameSchema,
  resolveListingSlugSchema,
  transferListingOwnershipSchema,
  upsertListingCustomDomainSchema,
  upsertListingDomainSchema,
} from './listings.schemas.js';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const listingsPlugin = fp(async (fastify) => {
  const service = new ListingsService(fastify.prisma);

  // Recrée la liste des domaines personnalisés pour certbot au démarrage (volume vide après un redéploiement).
  void service.syncCustomDomainsFile();

  fastify.get('/listings/domains/availability', {
    preHandler: fastify.authenticateOptional,
  }, async (request, reply) => {
    const query = listingDomainAvailabilitySchema.parse(request.query);
    const availability = await service.checkSubdomainAvailability(query.slug, {
      excludeListingId: query.excludeListingId,
      auth: request.auth,
    });
    reply.send(availability);
  });

  fastify.get('/listings/domains/resolve', {
    preHandler: fastify.authenticateOptional,
  }, async (request, reply) => {
    const query = resolveListingHostnameSchema.parse(request.query);
    const resolved = await service.resolveListingByHostname({
      hostname: query.hostname,
      listingSlug: query.listingSlug ?? null,
      auth: request.auth,
    });

    if (!resolved) {
      reply.code(404).send({ message: 'Listing not found for this hostname.' });
      return;
    }

    reply.send(resolved);
  });

  fastify.get('/listings/resolve', {
    preHandler: fastify.authenticateOptional,
  }, async (request, reply) => {
    const query = resolveListingSlugSchema.parse(request.query);
    const resolved = await service.resolveListingBySlug(query.slug, request.auth);

    if (!resolved) {
      reply.code(404).send({ message: 'Listing not found for this slug.' });
      return;
    }

    reply.send(resolved);
  });

  fastify.get('/listings/sitemap.xml', async (_request, reply) => {
    const entries = await service.listSitemapEntries();
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n`
      + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
      + entries.map((entry) => [
        '  <url>',
        `    <loc>${escapeXml(entry.publicUrl)}</loc>`,
        `    <lastmod>${escapeXml(entry.updatedAt)}</lastmod>`,
        '  </url>',
      ].join('\n')).join('\n')
      + `\n</urlset>`;

    reply
      .type('application/xml')
      .send(body);
  });

  fastify.get('/listings/:listingId/domain', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const params = listingIdParamsSchema.parse(request.params);
    const domain = await service.getListingDomain(params.listingId, request.auth);

    if (!domain) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    if (domain === 'forbidden') {
      reply.code(403).send({ message: 'You cannot access this listing domain.' });
      return;
    }

    reply.send(domain);
  });

  fastify.put('/listings/:listingId/domain', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const params = listingIdParamsSchema.parse(request.params);
    const payload = upsertListingDomainSchema.parse(asObject(request.body));
    const domain = await service.upsertListingDomain({
      listingId: params.listingId,
      slug: payload.slug,
      auth: request.auth,
    });

    if (!domain) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    if (domain === 'forbidden') {
      reply.code(403).send({ message: 'Vous ne pouvez pas modifier le sous-domaine de cette annonce.' });
      return;
    }

    if (typeof domain === 'object' && 'type' in domain && domain.type === 'conflict') {
      reply.code(409).send({ message: domain.reason ?? 'Ce sous-domaine n’est pas disponible.' });
      return;
    }

    if (domain === 'subscription_required') {
      reply.code(403).send({ message: 'Un plan d abonnement est requis pour réserver un sous-domaine.' });
      return;
    }

    reply.send(domain);
  });

  fastify.delete('/listings/:listingId/domain', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const params = listingIdParamsSchema.parse(request.params);
    const domain = await service.deleteListingDomain({
      listingId: params.listingId,
      auth: request.auth,
    });

    if (!domain) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    if (domain === 'forbidden') {
      reply.code(403).send({ message: 'You cannot edit this listing domain.' });
      return;
    }

    reply.send(domain);
  });

  fastify.put('/listings/:listingId/custom-domain', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const params = listingIdParamsSchema.parse(request.params);
    const payload = upsertListingCustomDomainSchema.parse(asObject(request.body));
    const result = await service.upsertListingCustomDomain({
      listingId: params.listingId,
      domain: payload.domain,
      auth: request.auth,
    });

    if (!result) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    if (result === 'forbidden') {
      reply.code(403).send({ message: 'Vous ne pouvez pas modifier le domaine de cette annonce.' });
      return;
    }

    if (result === 'subscription_required') {
      reply.code(403).send({ message: 'Un plan d abonnement est requis pour rattacher un nom de domaine.' });
      return;
    }

    if ('type' in result) {
      reply.code(result.type === 'conflict' ? 409 : 400).send({ message: result.reason });
      return;
    }

    reply.send(result);
  });

  fastify.post('/listings/:listingId/custom-domain/verify', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const params = listingIdParamsSchema.parse(request.params);
    const result = await service.verifyListingCustomDomain({
      listingId: params.listingId,
      auth: request.auth,
    });

    if (!result) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    if (result === 'forbidden') {
      reply.code(403).send({ message: 'Vous ne pouvez pas modifier le domaine de cette annonce.' });
      return;
    }

    if (result === 'no_custom_domain') {
      reply.code(409).send({ message: 'Aucun nom de domaine n’est rattaché à cette annonce.' });
      return;
    }

    reply.send(result);
  });

  fastify.delete('/listings/:listingId/custom-domain', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const params = listingIdParamsSchema.parse(request.params);
    const domain = await service.deleteListingCustomDomain({
      listingId: params.listingId,
      auth: request.auth,
    });

    if (!domain) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    if (domain === 'forbidden') {
      reply.code(403).send({ message: 'Vous ne pouvez pas modifier le domaine de cette annonce.' });
      return;
    }

    reply.send(domain);
  });

  fastify.get('/listings/:resource/:listingId', async (request, reply) => {
    const params = listingResourceParamsSchema.parse(request.params);
    const resource = await service.getListingResource(params.resource, params.listingId);

    if (!resource) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    reply.send(resource);
  });

  fastify.patch('/listings/:resource/:listingId', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const params = listingResourceParamsSchema.parse(request.params);
    const patch = patchListingResourceSchema.parse(asObject(request.body));

    const updated = await service.patchListingResource({
      listingId: params.listingId,
      resource: params.resource,
      patch,
      auth: request.auth,
    });

    if (!updated) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    if (updated === 'forbidden') {
      reply.code(403).send({ message: 'You cannot edit this listing.' });
      return;
    }

    reply.send(updated);
  });

  fastify.post('/listings', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const payload = createListingSchema.parse(asObject(request.body));
    const created = await service.createListing(payload, request.auth);
    reply.code(201).send(created);
  });

  fastify.post('/listings/admin/:listingId/transfer', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const params = listingIdParamsSchema.parse(request.params);
    const payload = transferListingOwnershipSchema.parse(asObject(request.body));

    const transferred = await service.transferListingOwnership({
      listingId: params.listingId,
      targetUserId: payload.targetUserId,
      trialDays: payload.trialDays,
      auth: request.auth,
    });

    if (!transferred) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    if (transferred === 'target_not_found') {
      reply.code(404).send({ message: 'Target user not found.' });
      return;
    }

    if (transferred === 'forbidden') {
      reply.code(403).send({ message: 'Admin access required.' });
      return;
    }

    reply.send(transferred);
  });

  fastify.get('/listings/bundle/:listingId', {
    preHandler: fastify.authenticateOptional,
  }, async (request, reply) => {
    const params = listingIdParamsSchema.parse(request.params);
    const bundle = await service.getListingBundle(params.listingId, request.auth);

    if (!bundle) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    reply.send(bundle);
  });
});
