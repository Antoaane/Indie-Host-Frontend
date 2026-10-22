import { randomUUID } from 'node:crypto';

import { env } from '../../config/env.js';

const IMAGEKIT_UPLOAD_API_URL = 'https://upload.imagekit.io/api/v1/files/upload';
const DEFAULT_FALLBACK_EXTENSION = 'webp';

export const VIDEO_MAX_BYTES = 150 * 1024 * 1024;
export const VIDEO_EXTENSION_BY_MIME: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

// Seuls formats d'image acceptés en envoi direct (data URL) : le contenu est aussi vérifié par signature.
export const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

const IMAGE_FILE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'heic', 'heif']);

/**
 * Hôtes dont l'import d'annonce (scraper Airbnb / Booking.com) rapporte les photos.
 * ImageKit télécharge lui-même l'URL : tout autre hôte est refusé pour qu'on ne puisse pas
 * héberger n'importe quel fichier distant sur le compte ImageKit d'IndieHost.
 */
export const REMOTE_IMAGE_HOST_SUFFIXES = ['muscache.com', 'bstatic.com'];

export type ImageKitFolderCategory = 'gallery' | 'scraped' | 'videos';

/** Erreur de saisie (format, URL refusée) : renvoyée telle quelle au client par le gestionnaire d'erreurs. */
export class ImageKitInputError extends Error {
  constructor(readonly statusCode: number, message: string) {
    super(message);
  }
}

type UploadImageInput = {
  file: string;
  fileName: string;
  folder: string;
  tags?: string[];
};

type UploadDataImageInput = {
  fileData: string;
  fileName?: string;
  listingId?: string | null;
  tags?: string[];
  fallbackBaseName?: string;
};

type UploadRemoteImageInput = {
  url: string;
  fileName?: string;
  listingId?: string | null;
  tags?: string[];
  fallbackBaseName?: string;
};

export type ImageKitUploadedImage = {
  url: string;
  fileId: string | null;
  name: string | null;
  filePath: string | null;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  size: number | null;
  fileType: string | null;
};

function normalizeTrimmedString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizePathSegment(segment: string): string {
  return segment
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sanitizeFolderPath(folder: string): string {
  const clean = normalizeTrimmedString(folder);
  if (!clean) return '';

  const parts = clean
    .split('/')
    .map((part) => normalizePathSegment(part))
    .filter(Boolean);

  if (!parts.length) return '';
  return `/${parts.join('/')}`;
}

function extractExtensionFromFileName(fileName: string): string | null {
  const clean = normalizeTrimmedString(fileName);
  const match = clean.match(/\.([a-z0-9]{2,8})$/i);
  if (!match?.[1]) return null;
  return match[1].toLowerCase();
}

type SniffedImageKind = 'jpg' | 'png' | 'gif' | 'webp' | 'isobmff';

function sniffImageKind(bytes: Buffer): SniffedImageKind | null {
  const ascii = (start: number, end: number) => bytes.subarray(start, end).toString('latin1');

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (bytes.length >= 6 && (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a')) return 'gif';
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  // AVIF / HEIC : conteneur ISO-BMFF (`ftyp` à l'octet 4), la marque varie selon l'encodeur.
  if (bytes.length >= 12 && ascii(4, 8) === 'ftyp') return 'isobmff';
  return null;
}

/**
 * N'accepte qu'une data URL base64 d'image (JPEG, PNG, WebP, GIF, AVIF, HEIC) dont le contenu
 * correspond bien à une image. Une chaîne brute serait interprétée par ImageKit comme une URL à télécharger.
 */
function parseImageDataUrl(data: string): { payload: string; extension: string } {
  const trimmed = normalizeTrimmedString(data);
  const match = trimmed.match(/^data:([^;,]+);base64,([\s\S]+)$/i);
  const unsupported = new ImageKitInputError(415, 'Format d’image non supporté. Utilisez JPEG, PNG, WebP, GIF, AVIF ou HEIC.');

  if (!match?.[2]) throw unsupported;

  const declaredExtension = IMAGE_EXTENSION_BY_MIME[normalizeTrimmedString(match[1]).toLowerCase()];
  const payload = match[2].replace(/\s+/g, '');
  if (!declaredExtension || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) throw unsupported;

  const sniffed = sniffImageKind(Buffer.from(payload.slice(0, 64), 'base64'));
  if (!sniffed) throw unsupported;

  if (sniffed === 'isobmff') {
    if (!['avif', 'heic', 'heif'].includes(declaredExtension)) throw unsupported;
    return { payload, extension: declaredExtension };
  }

  return { payload, extension: sniffed };
}

function sniffVideoMatchesMime(bytes: Buffer, mimeType: string): boolean {
  if (mimeType === 'video/webm') {
    return bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  }

  // MP4 / MOV : premier atome QuickTime (`ftyp` en général, d'anciens .mov commencent par `moov`, `wide`…).
  const atom = bytes.subarray(4, 8).toString('latin1');
  return ['ftyp', 'moov', 'mdat', 'free', 'skip', 'wide', 'pnot', 'uuid'].includes(atom);
}

/** URL d'une photo d'annonce importée : https, port par défaut, hôte des CDN Airbnb / Booking.com. */
function assertAllowedRemoteImageUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new ImageKitInputError(400, 'URL d’image invalide.');
  }

  const hostname = parsed.hostname.toLowerCase();
  const isAllowedHost = REMOTE_IMAGE_HOST_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));

  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || !isAllowedHost) {
    throw new ImageKitInputError(400, 'Seules les photos Airbnb et Booking.com (https) peuvent être importées.');
  }
}

function sanitizeFileName(rawFileName: string, forcedExtension?: string): string {
  const clean = normalizeTrimmedString(rawFileName);
  const basename = clean.replace(/\.[a-z0-9]{2,8}$/i, '');
  const nameExtension = extractExtensionFromFileName(clean);
  // Jamais une extension hors image choisie par le client (`.html`, `.svg`…) : ImageKit sert le fichier sous ce nom.
  const extension = forcedExtension
    ?? (nameExtension && IMAGE_FILE_EXTENSIONS.has(nameExtension) ? nameExtension : DEFAULT_FALLBACK_EXTENSION);

  const normalizedBase = basename
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  const safeBase = normalizedBase || `image-${randomUUID().slice(0, 8)}`;
  return `${safeBase}.${extension}`;
}

function buildFileNameFromRemoteUrl(rawUrl: string, fallbackBaseName: string): string {
  const fallback = sanitizeFileName(`${fallbackBaseName}.${DEFAULT_FALLBACK_EXTENSION}`);

  try {
    const parsed = new URL(rawUrl);
    const lastPathSegment = parsed.pathname.split('/').filter(Boolean).pop() ?? '';
    if (!lastPathSegment) return fallback;

    const cleaned = decodeURIComponent(lastPathSegment).trim();
    if (!cleaned) return fallback;

    const withExtension = extractExtensionFromFileName(cleaned)
      ? cleaned
      : `${cleaned}.${DEFAULT_FALLBACK_EXTENSION}`;
    return sanitizeFileName(withExtension);
  } catch {
    return fallback;
  }
}

function buildFileNameFromDataUrl(input: {
  desiredFileName?: string;
  dataExtension: string;
  fallbackBaseName: string;
}): string {
  // L'extension suit le contenu vérifié, jamais le nom envoyé par le client.
  const desired = normalizeTrimmedString(input.desiredFileName);
  return sanitizeFileName(desired || input.fallbackBaseName, input.dataExtension);
}

export class ImageKitService {
  private readonly privateKey = normalizeTrimmedString(env.IMAGEKIT_API_KEY);
  private readonly endpoint = normalizeTrimmedString(env.IMAGEKIT_ENDPOINT).replace(/\/+$/, '');
  private readonly defaultFolder = sanitizeFolderPath(env.IMAGEKIT_UPLOAD_DEFAULT_FOLDER) || '/indiehost/listings';

  isConfigured(): boolean {
    return Boolean(this.privateKey && this.endpoint);
  }

  getEndpoint(): string {
    return this.endpoint;
  }

  isImageKitUrl(rawUrl: string): boolean {
    const candidateUrl = normalizeTrimmedString(rawUrl);
    if (!candidateUrl) return false;

    if (!this.endpoint) {
      try {
        const parsed = new URL(candidateUrl);
        return /(^|\.)imagekit\.io$/i.test(parsed.hostname);
      } catch {
        return candidateUrl.includes('imagekit.io/');
      }
    }

    try {
      const endpointUrl = new URL(this.endpoint);
      const parsed = new URL(candidateUrl);
      if (endpointUrl.origin !== parsed.origin) return false;

      const endpointPath = endpointUrl.pathname.replace(/\/+$/, '');
      if (!endpointPath) return true;

      return parsed.pathname === endpointPath || parsed.pathname.startsWith(`${endpointPath}/`);
    } catch {
      return candidateUrl.startsWith(this.endpoint);
    }
  }

  /**
   * Dossier de destination, toujours calculé côté API (jamais fourni par le client) :
   * `<dossier par défaut>/<listingId>/<catégorie>`, ou `<dossier par défaut>/<catégorie>` sans annonce.
   */
  resolveListingFolder(listingId: string | null | undefined, category: ImageKitFolderCategory): string {
    const listingSegment = normalizePathSegment(listingId ?? '');
    return [this.defaultFolder, listingSegment, category].filter(Boolean).join('/');
  }

  async uploadDataImage(input: UploadDataImageInput): Promise<ImageKitUploadedImage> {
    const parsedPayload = parseImageDataUrl(input.fileData);
    const fallbackBaseName = normalizePathSegment(input.fallbackBaseName ?? '') || `image-${Date.now()}`;
    const fileName = buildFileNameFromDataUrl({
      desiredFileName: input.fileName,
      dataExtension: parsedPayload.extension,
      fallbackBaseName,
    });

    return this.uploadImage({
      file: parsedPayload.payload,
      fileName,
      folder: this.resolveListingFolder(input.listingId, 'gallery'),
      tags: input.tags,
    });
  }

  async uploadRemoteImage(input: UploadRemoteImageInput): Promise<ImageKitUploadedImage> {
    const url = normalizeTrimmedString(input.url);
    if (!url) {
      throw new Error('Image URL is required.');
    }

    assertAllowedRemoteImageUrl(url);

    const fallbackBaseName = normalizePathSegment(input.fallbackBaseName ?? '') || `scraped-${Date.now()}`;
    const fileName = input.fileName
      ? sanitizeFileName(input.fileName)
      : buildFileNameFromRemoteUrl(url, fallbackBaseName);

    return this.uploadImage({
      file: url,
      fileName,
      folder: this.resolveListingFolder(input.listingId, 'scraped'),
      tags: input.tags,
    });
  }

  /**
   * Vidéo envoyée en binaire par l'API (multipart vers ImageKit, sans passage par base64).
   * Le poster est dérivé de l'URL ImageKit (`/ik-thumbnail.jpg`).
   */
  async uploadVideoBuffer(input: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    listingId?: string | null;
    tags?: string[];
  }): Promise<ImageKitUploadedImage & { posterUrl: string }> {
    if (!this.isConfigured()) {
      throw new Error('ImageKit is not configured on the API server.');
    }

    const extension = VIDEO_EXTENSION_BY_MIME[input.mimeType];
    if (!extension || !sniffVideoMatchesMime(input.buffer.subarray(0, 16), input.mimeType)) {
      throw new ImageKitInputError(415, 'Format vidéo non supporté. Utilisez MP4, WebM ou MOV.');
    }

    const baseName = normalizePathSegment(input.fileName.replace(/\.[a-z0-9]{2,8}$/i, '')) || `video-${randomUUID().slice(0, 8)}`;
    const fileName = `${baseName}.${extension}`;

    const form = new FormData();
    form.append('file', new Blob([input.buffer], { type: input.mimeType }), fileName);
    form.append('fileName', fileName);
    form.append('folder', this.resolveListingFolder(input.listingId, 'videos'));
    form.append('useUniqueFileName', 'true');
    form.append('overwriteFile', 'false');
    const tags = Array.isArray(input.tags) ? input.tags.map((tag) => normalizeTrimmedString(tag)).filter(Boolean) : [];
    if (tags.length) form.append('tags', tags.join(','));

    const response = await fetch(IMAGEKIT_UPLOAD_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.privateKey}:`).toString('base64')}`,
      },
      body: form,
    });

    const rawText = await response.text();
    let payload: Record<string, unknown> | null = null;
    try {
      payload = rawText ? JSON.parse(rawText) as Record<string, unknown> : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const messageFromBody = normalizeTrimmedString(payload?.message)
        || normalizeTrimmedString(payload?.error)
        || normalizeTrimmedString(rawText);
      throw new Error(messageFromBody || `ImageKit video upload failed with status ${response.status}.`);
    }

    const uploadedUrl = normalizeTrimmedString(payload?.url);
    if (!uploadedUrl) {
      throw new Error('ImageKit upload did not return a URL.');
    }

    return {
      url: uploadedUrl,
      posterUrl: `${uploadedUrl}/ik-thumbnail.jpg`,
      fileId: normalizeTrimmedString(payload?.fileId) || null,
      name: normalizeTrimmedString(payload?.name) || null,
      filePath: normalizeTrimmedString(payload?.filePath) || null,
      thumbnailUrl: normalizeTrimmedString(payload?.thumbnailUrl) || null,
      width: toNumberOrNull(payload?.width),
      height: toNumberOrNull(payload?.height),
      size: toNumberOrNull(payload?.size),
      fileType: normalizeTrimmedString(payload?.fileType) || null,
    };
  }

  private async uploadImage(input: UploadImageInput): Promise<ImageKitUploadedImage> {
    if (!this.isConfigured()) {
      throw new Error('ImageKit is not configured on the API server.');
    }

    const body = new URLSearchParams();
    body.set('file', input.file);
    body.set('fileName', sanitizeFileName(input.fileName));
    // Jamais d'écrasement d'un fichier existant, même si un nom identique est envoyé.
    body.set('folder', input.folder);
    body.set('useUniqueFileName', 'true');
    body.set('overwriteFile', 'false');

    const tags = Array.isArray(input.tags)
      ? input.tags.map((tag) => normalizeTrimmedString(tag)).filter(Boolean)
      : [];
    if (tags.length) {
      body.set('tags', tags.join(','));
    }

    const authorization = `Basic ${Buffer.from(`${this.privateKey}:`).toString('base64')}`;
    const response = await fetch(IMAGEKIT_UPLOAD_API_URL, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const rawText = await response.text();
    let payload: Record<string, unknown> | null = null;

    try {
      payload = rawText ? JSON.parse(rawText) as Record<string, unknown> : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const messageFromBody = normalizeTrimmedString(payload?.message)
        || normalizeTrimmedString(payload?.error)
        || normalizeTrimmedString(rawText);
      throw new Error(messageFromBody || `ImageKit upload failed with status ${response.status}.`);
    }

    const uploadedUrl = normalizeTrimmedString(payload?.url);
    if (!uploadedUrl) {
      throw new Error('ImageKit upload did not return a URL.');
    }

    return {
      url: uploadedUrl,
      fileId: normalizeTrimmedString(payload?.fileId) || null,
      name: normalizeTrimmedString(payload?.name) || null,
      filePath: normalizeTrimmedString(payload?.filePath) || null,
      thumbnailUrl: normalizeTrimmedString(payload?.thumbnailUrl) || null,
      width: toNumberOrNull(payload?.width),
      height: toNumberOrNull(payload?.height),
      size: toNumberOrNull(payload?.size),
      fileType: normalizeTrimmedString(payload?.fileType) || null,
    };
  }
}
