import { z } from 'zod';

export const mediaListingParamsSchema = z.object({
  listingId: z.string().min(1),
});

export const patchMediaSchema = z.record(z.any());

// Le dossier ImageKit est imposé par l'API. `folder` n'est lu que pour en extraire l'annonce
// (ancien format du front : `/listings/<listingId>/<catégorie>`). `useUniqueFileName` est ignoré (toujours vrai).
const optionalFolderSchema = z.string().trim().min(1).max(255).optional();
const optionalListingIdSchema = z.string().trim().min(1).max(255).optional();

export const imagekitUploadSchema = z.object({
  fileData: z.string().trim().min(1),
  fileName: z.string().trim().min(1).max(255).optional(),
  listingId: optionalListingIdSchema,
  folder: optionalFolderSchema,
});

export const imagekitImportSchema = z.object({
  images: z.array(z.object({
    url: z.string().trim().url(),
    fileName: z.string().trim().min(1).max(255).optional(),
    alt: z.string().trim().max(255).optional(),
    position: z.number().int().min(0).optional(),
  })).min(1).max(200),
  listingId: optionalListingIdSchema,
  folder: optionalFolderSchema,
});

/** `/listings/<listingId>/gallery|scraped` (dossier envoyé par le front) → `<listingId>`. */
export function readListingIdFromLegacyFolder(folder: string | undefined): string | null {
  const match = (folder ?? '').trim().match(/^\/?listings\/([a-zA-Z0-9_-]+)\/(?:gallery|scraped)\/?$/);
  return match?.[1] ?? null;
}
