import fp from 'fastify-plugin';

import { asObject } from '../../lib/json.js';
import { ImageKitService } from './imagekit.service.js';
import {
  imagekitImportSchema,
  imagekitUploadSchema,
  mediaListingParamsSchema,
  patchMediaSchema,
} from './medias.schemas.js';
import { MediasService } from './medias.service.js';

export const mediasPlugin = fp(async (fastify) => {
  const service = new MediasService(fastify.prisma);
  const imageKit = new ImageKitService();

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
    const uploaded = await imageKit.uploadDataImage({
      fileData: payload.fileData,
      fileName: payload.fileName,
      folder: payload.folder,
      useUniqueFileName: payload.useUniqueFileName,
      tags: ['indiehost', 'upload', 'editor'],
    });

    reply.send({
      image: uploaded,
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
    const folder = imageKit.resolveFolder(payload.folder);

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
        folder,
        useUniqueFileName: payload.useUniqueFileName,
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
