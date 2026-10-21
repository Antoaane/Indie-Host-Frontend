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

type UploadImageInput = {
  file: string;
  fileName: string;
  folder?: string;
  useUniqueFileName?: boolean;
  tags?: string[];
};

type UploadDataImageInput = {
  fileData: string;
  fileName?: string;
  folder?: string;
  useUniqueFileName?: boolean;
  tags?: string[];
  fallbackBaseName?: string;
};

type UploadRemoteImageInput = {
  url: string;
  fileName?: string;
  folder?: string;
  useUniqueFileName?: boolean;
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

function fileExtensionFromMimeType(mimeType: string): string | null {
  const normalized = normalizeTrimmedString(mimeType).toLowerCase();
  if (!normalized) return null;

  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'jpg';
  if (normalized === 'image/png') return 'png';
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'image/avif') return 'avif';
  if (normalized === 'image/gif') return 'gif';

  const [type, subtype] = normalized.split('/');
  if (type !== 'image' || !subtype) return null;
  const candidate = subtype.split('+')[0]?.trim() ?? '';
  const cleaned = candidate.replace(/[^a-z0-9]/gi, '');
  return cleaned || null;
}

function extractExtensionFromFileName(fileName: string): string | null {
  const clean = normalizeTrimmedString(fileName);
  const match = clean.match(/\.([a-z0-9]{2,8})$/i);
  if (!match?.[1]) return null;
  return match[1].toLowerCase();
}

function parseDataUrlPayload(data: string): { payload: string; extension: string | null } {
  const trimmed = normalizeTrimmedString(data);
  const match = trimmed.match(/^data:([^;,]+);base64,([\s\S]+)$/i);

  if (!match?.[2]) {
    return {
      payload: trimmed,
      extension: null,
    };
  }

  return {
    payload: match[2].trim(),
    extension: fileExtensionFromMimeType(match[1] ?? ''),
  };
}

function sanitizeFileName(rawFileName: string): string {
  const clean = normalizeTrimmedString(rawFileName);
  const basename = clean.replace(/\.[a-z0-9]{2,8}$/i, '');
  const extension = extractExtensionFromFileName(clean) ?? DEFAULT_FALLBACK_EXTENSION;

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
  dataExtension: string | null;
  fallbackBaseName: string;
}): string {
  const desired = normalizeTrimmedString(input.desiredFileName);
  if (desired) {
    const extension = extractExtensionFromFileName(desired);
    if (extension) return sanitizeFileName(desired);
    const nextExtension = input.dataExtension ?? DEFAULT_FALLBACK_EXTENSION;
    return sanitizeFileName(`${desired}.${nextExtension}`);
  }

  const fallbackExtension = input.dataExtension ?? DEFAULT_FALLBACK_EXTENSION;
  return sanitizeFileName(`${input.fallbackBaseName}.${fallbackExtension}`);
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

  resolveFolder(folder?: string): string {
    const sanitizedInput = sanitizeFolderPath(folder ?? '');
    if (sanitizedInput) return sanitizedInput;
    return this.defaultFolder;
  }

  async uploadDataImage(input: UploadDataImageInput): Promise<ImageKitUploadedImage> {
    const parsedPayload = parseDataUrlPayload(input.fileData);
    const fallbackBaseName = normalizePathSegment(input.fallbackBaseName ?? '') || `image-${Date.now()}`;
    const fileName = buildFileNameFromDataUrl({
      desiredFileName: input.fileName,
      dataExtension: parsedPayload.extension,
      fallbackBaseName,
    });

    return this.uploadImage({
      file: parsedPayload.payload,
      fileName,
      folder: input.folder,
      useUniqueFileName: input.useUniqueFileName,
      tags: input.tags,
    });
  }

  async uploadRemoteImage(input: UploadRemoteImageInput): Promise<ImageKitUploadedImage> {
    const url = normalizeTrimmedString(input.url);
    if (!url) {
      throw new Error('Image URL is required.');
    }

    const fallbackBaseName = normalizePathSegment(input.fallbackBaseName ?? '') || `scraped-${Date.now()}`;
    const fileName = input.fileName
      ? sanitizeFileName(input.fileName)
      : buildFileNameFromRemoteUrl(url, fallbackBaseName);

    return this.uploadImage({
      file: url,
      fileName,
      folder: input.folder,
      useUniqueFileName: input.useUniqueFileName,
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
    folder?: string;
    tags?: string[];
  }): Promise<ImageKitUploadedImage & { posterUrl: string }> {
    if (!this.isConfigured()) {
      throw new Error('ImageKit is not configured on the API server.');
    }

    const extension = VIDEO_EXTENSION_BY_MIME[input.mimeType] ?? extractExtensionFromFileName(input.fileName) ?? 'mp4';
    const baseName = normalizePathSegment(input.fileName.replace(/\.[a-z0-9]{2,8}$/i, '')) || `video-${randomUUID().slice(0, 8)}`;
    const fileName = `${baseName}.${extension}`;

    const form = new FormData();
    form.append('file', new Blob([input.buffer], { type: input.mimeType }), fileName);
    form.append('fileName', fileName);
    form.append('folder', this.resolveFolder(input.folder));
    form.append('useUniqueFileName', 'true');
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
    body.set('folder', this.resolveFolder(input.folder));
    body.set('useUniqueFileName', input.useUniqueFileName === false ? 'false' : 'true');

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
