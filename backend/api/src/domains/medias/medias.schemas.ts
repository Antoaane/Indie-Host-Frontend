import { z } from 'zod';

export const mediaListingParamsSchema = z.object({
  listingId: z.string().min(1),
});

export const patchMediaSchema = z.record(z.any());

const optionalFolderSchema = z.string().trim().min(1).max(255).optional();

export const imagekitUploadSchema = z.object({
  fileData: z.string().trim().min(1),
  fileName: z.string().trim().min(1).max(255).optional(),
  folder: optionalFolderSchema,
  useUniqueFileName: z.boolean().optional().default(true),
});

export const imagekitImportSchema = z.object({
  images: z.array(z.object({
    url: z.string().trim().url(),
    fileName: z.string().trim().min(1).max(255).optional(),
    alt: z.string().trim().max(255).optional(),
    position: z.number().int().min(0).optional(),
  })).min(1).max(200),
  folder: optionalFolderSchema,
  useUniqueFileName: z.boolean().optional().default(true),
});
