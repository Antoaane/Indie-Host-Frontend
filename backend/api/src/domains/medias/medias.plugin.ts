import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { asObject } from '../../lib/json.js';
import { ImageKitService, VIDEO_EXTENSION_BY_MIME, VIDEO_MAX_BYTES } from './imagekit.service.js';
import {
  imagekitImportSchema,
  imagekitUploadSchema,
  mediaListingParamsSchema,
  patchMediaSchema,
  readListingIdFromLegacyFolder,
} from './medias.schemas.js';
import { MediasService } from './medias.service.js';
import { resolveListingAccess } from '../listings/listings.access.js';

// Marge pour les en-têtes : le corps binaire d'une vidéo ne dépasse pas VIDEO_MAX_BYTES.
const VIDEO_BODY_LIMIT_BYTES = VIDEO_MAX_BYTES + 1024 * 1024;

function readHeader(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' ? raw.trim() : '';
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export const mediasPlugin = fp(async (fastify) => {
  const service = new MediasService(fastify.prisma);
  const imageKit = new ImageKitService();

  // Envoi rattaché à une annonce : seul qui peut la modifier (propriétaire ou admin) dépose dans son dossier ImageKit.
  async function ensureCanUploadToListing(request: FastifyRequest, reply: FastifyReply, listingId: string | null): Promise<boolean> {
    if (!listingId) return true;

    const access = await resolveListingAccess(fastify.prisma, listingId, request.auth);
    if (!access) {
      reply.code(404).send({ message: 'Listing not found.' });
      return false;
    }

    if (!access.canWrite) {
      reply.code(403).send({ message: 'You cannot edit this listing.' });
      return false;
    }

    return true;
  }

  fastify.get('/medias/listings/:listingId', async (request, reply) => {
    const { listingId } = mediaListingParamsSchema.parse(request.params);
    const medias = await service.getListingMedias(listingId);

    if (!medias) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    reply.send(medias);
  });

  fastify.patch('/medias/listings/:listingId', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const { listingId } = mediaListingParamsSchema.parse(request.params);
    const patch = patchMediaSchema.parse(asObject(request.body));

    const access = await resolveListingAccess(fastify.prisma, listingId, request.auth);
    if (access && !access.canWrite) {
      reply.code(403).send({ message: 'You cannot edit this listing.' });
      return;
    }

    const medias = await service.patchListingMedias(listingId, patch);

    if (!medias) {
      reply.code(404).send({ message: 'Listing not found.' });
      return;
    }

    reply.send(medias);
  });

  fastify.post('/medias/imagekit/upload', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    if (!imageKit.isConfigured()) {
      reply.code(503).send({
        message: 'ImageKit is not configured on API server.',
      });
      return;
    }

    const payload = imagekitUploadSchema.parse(asObject(request.body));
    const listingId = payload.listingId ?? readListingIdFromLegacyFolder(payload.folder);
    if (!await ensureCanUploadToListing(request, reply, listingId)) return;

    const uploaded = await imageKit.uploadDataImage({
      fileData: payload.fileData,
      fileName: payload.fileName,
      listingId,
      tags: ['indiehost', 'upload', 'editor'],
    });

    reply.send({
      image: uploaded,
      endpoint: imageKit.getEndpoint(),
    });
  });

  // Vidéos : corps binaire brut (application/octet-stream) + en-têtes x-file-name / x-file-type / x-listing-id.
  fastify.addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: VIDEO_BODY_LIMIT_BYTES }, (_request, body, done) => {
    done(null, body);
  });

  fastify.post('/medias/imagekit/upload-video', {
    preHandler: fastify.authenticate,
    bodyLimit: VIDEO_BODY_LIMIT_BYTES,
  }, async (request, reply) => {
    if (!imageKit.isConfigured()) {
      reply.code(503).send({ message: 'ImageKit is not configured on API server.' });
      return;
    }

    const body = request.body;
    if (!Buffer.isBuffer(body) || !body.length) {
      reply.code(400).send({ message: 'Fichier vidéo manquant.' });
      return;
    }

    const mimeType = readHeader(request.headers['x-file-type']).toLowerCase();
    if (!VIDEO_EXTENSION_BY_MIME[mimeType]) {
      reply.code(415).send({ message: 'Format vidéo non supporté. Utilisez MP4, WebM ou MOV.' });
      return;
    }

    if (body.length > VIDEO_MAX_BYTES) {
      reply.code(413).send({ message: `Vidéo trop lourde (max ${Math.round(VIDEO_MAX_BYTES / (1024 * 1024))} Mo).` });
      return;
    }

    const fileName = safeDecodeURIComponent(readHeader(request.headers['x-file-name'])) || `video-${Date.now()}`;
    const listingId = readHeader(request.headers['x-listing-id']) || null;
    if (!await ensureCanUploadToListing(request, reply, listingId)) return;

    const uploaded = await imageKit.uploadVideoBuffer({
      buffer: body,
      fileName,
      mimeType,
      listingId,
      tags: ['indiehost', 'upload', 'editor', 'video'],
    });

    reply.send({
      video: uploaded,
      endpoint: imageKit.getEndpoint(),
    });
  });

  fastify.post('/medias/imagekit/import', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    if (!imageKit.isConfigured()) {
      reply.code(503).send({
        message: 'ImageKit is not configured on API server.',
      });
      return;
    }

    const payload = imagekitImportSchema.parse(asObject(request.body));
    const listingId = payload.listingId ?? readListingIdFromLegacyFolder(payload.folder);
    if (!await ensureCanUploadToListing(request, reply, listingId)) return;

    const bySourceUrl = new Map<string, Promise<{
      image: Awaited<ReturnType<ImageKitService['uploadRemoteImage']>> | null;
      error: string | null;
    }>>();

    const images = await Promise.all(payload.images.map(async (input, index) => {
      const sourceUrl = input.url.trim();
      const alt = input.alt?.trim() ?? '';
      const position = typeof input.position === 'number' ? input.position : index;

      if (imageKit.isImageKitUrl(sourceUrl)) {
        return {
          sourceUrl,
          url: sourceUrl,
          alt,
          position,
          uploaded: false,
          fileId: null,
          filePath: null,
          name: input.fileName?.trim() || null,
          error: null,
        };
      }

      const existingPromise = bySourceUrl.get(sourceUrl);
      if (existingPromise) {
        const result = await existingPromise;
        return {
          sourceUrl,
          url: result.image?.url ?? sourceUrl,
          alt,
          position,
          uploaded: Boolean(result.image?.url),
          fileId: result.image?.fileId ?? null,
          filePath: result.image?.filePath ?? null,
          name: result.image?.name ?? null,
          error: result.error,
        };
      }

      const uploadPromise = imageKit.uploadRemoteImage({
        url: sourceUrl,
        fileName: input.fileName,
        listingId,
        fallbackBaseName: `scraped-${position + 1}`,
        tags: ['indiehost', 'scraped', 'editor'],
      }).then((image) => ({
        image,
        error: null,
      })).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unable to import this image to ImageKit.';
        request.log.warn({ err: error, sourceUrl }, 'ImageKit import failed for scraped image');
        return {
          image: null,
          error: message,
        };
      });

      bySourceUrl.set(sourceUrl, uploadPromise);
      const result = await uploadPromise;

      return {
        sourceUrl,
        url: result.image?.url ?? sourceUrl,
        alt,
        position,
        uploaded: Boolean(result.image?.url),
        fileId: result.image?.fileId ?? null,
        filePath: result.image?.filePath ?? null,
        name: result.image?.name ?? null,
        error: result.error,
      };
    }));

    reply.send({
      images,
      endpoint: imageKit.getEndpoint(),
    });
  });
});
