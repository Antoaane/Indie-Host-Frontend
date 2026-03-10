// File: src/domain/api/imagekit.ts

import clerkToken from '@/utils/clerkToken'
import type { RawMedias } from '@/domain/listings/types'
import { readOptimizedImageDataUrl } from '@/utils/imageDataUrl'
import { normalizeListingStatus } from '@/domain/listings/status'

type ApiUploadResponse = {
  image?: {
    url?: unknown
    fileId?: unknown
    filePath?: unknown
    name?: unknown
  } | null
}

type ApiImportResponse = {
  images?: Array<{
    sourceUrl?: unknown
    url?: unknown
    alt?: unknown
    position?: unknown
    uploaded?: unknown
    error?: unknown
  }>
}

type ImageKitCopyInput = {
  src: string
  alt?: string
  position?: number
}

type UploadImageOptions = {
  listingId?: string | null
  listingStatus?: string | null
  folder?: string
  fileName?: string
}

const RAW_BASE_API_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim()
const BASE_API_URL = normalizeApiBaseUrl(RAW_BASE_API_URL)
const LISTINGS_MODE = (import.meta.env.VITE_LISTINGS_DATA_MODE ?? 'local-json').toString().trim().toLowerCase()
const IMAGEKIT_UPLOAD_PATH = normalizePath((import.meta.env.VITE_IMAGEKIT_UPLOAD_PATH ?? '/medias/imagekit/upload').toString())
const IMAGEKIT_IMPORT_PATH = normalizePath((import.meta.env.VITE_IMAGEKIT_IMPORT_PATH ?? '/medias/imagekit/import').toString())
const IMAGEKIT_ENDPOINT = (import.meta.env.VITE_IMAGEKIT_ENDPOINT ?? '').toString().trim().replace(/\/+$/, '')
const API_REQUEST_TIMEOUT_MS = resolveRequestTimeoutMs(import.meta.env.VITE_API_REQUEST_TIMEOUT_MS, 20_000)

function resolveRequestTimeoutMs(rawValue: unknown, fallback: number): number {
  const parsed = Number(rawValue)
  if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed)
  return fallback
}

function normalizeApiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/$/, '')
  if (!trimmed) return ''
  return trimmed
}

function normalizePath(path: string): string {
  const trimmed = path.trim()
  if (!trimmed) return '/'
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function joinUrl(base: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const normalizedBase = base.replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (!normalizedBase) return normalizedPath
  return `${normalizedBase}${normalizedPath}`
}

function resolveUrl(url: string): string {
  if (typeof window === 'undefined') return url
  return new URL(url, window.location.origin).toString()
}

function buildApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  return joinUrl(BASE_API_URL, path)
}

function normalizeTrimmedString(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function normalizeListingId(value: unknown): string {
  return normalizeTrimmedString(value)
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function resolveImageFolder(options?: { listingId?: string | null; category?: 'gallery' | 'scraped' }): string {
  const listingId = normalizeListingId(options?.listingId ?? '')
  const category = options?.category ?? 'gallery'
  if (!listingId) {
    throw new Error("L'identifiant de l'annonce est requis pour envoyer des médias vers ImageKit.")
  }
  return `/listings/${listingId}/${category}`
}

function isPublishedStatus(status?: string | null): boolean {
  return normalizeListingStatus(status) === 'published'
}

function assertCanUploadToImageKit(options?: UploadImageOptions) {
  if (!isPublishedStatus(options?.listingStatus)) {
    throw new Error("ImageKit est disponible uniquement après une première publication de l'annonce.")
  }
}

function extensionFromMimeType(mimeType: string): string | null {
  const normalized = normalizeTrimmedString(mimeType).toLowerCase()
  if (!normalized) return null
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'jpg'
  if (normalized === 'image/png') return 'png'
  if (normalized === 'image/webp') return 'webp'
  if (normalized === 'image/avif') return 'avif'
  const match = normalized.match(/^image\/([a-z0-9.+-]+)$/i)
  if (!match?.[1]) return null
  return match[1].split('+')[0]?.replace(/[^a-z0-9]/gi, '') || null
}

function extensionFromDataUrl(dataUrl: string): string | null {
  const match = dataUrl.match(/^data:([^;,]+);base64,/i)
  if (!match?.[1]) return null
  return extensionFromMimeType(match[1])
}

function extensionFromFileName(fileName: string): string | null {
  const match = fileName.match(/\.([a-z0-9]{2,8})$/i)
  if (!match?.[1]) return null
  return match[1].toLowerCase()
}

function sanitizeFileName(input: string, fallbackBaseName: string, fallbackExtension = 'webp'): string {
  const trimmed = normalizeTrimmedString(input)
  const extension = extensionFromFileName(trimmed) ?? fallbackExtension
  const baseName = trimmed.replace(/\.[a-z0-9]{2,8}$/i, '')
  const safeBase = normalizeTrimmedString(baseName)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  const resolvedBase = safeBase || fallbackBaseName
  return `${resolvedBase}.${extension}`
}

function inferRemoteFileName(url: string, index: number): string {
  try {
    const parsed = new URL(url)
    const pathName = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() ?? '')
    if (!pathName) return `scraped-${index + 1}.webp`
    const extension = extensionFromFileName(pathName) ?? 'webp'
    return sanitizeFileName(pathName, `scraped-${index + 1}`, extension)
  } catch {
    return `scraped-${index + 1}.webp`
  }
}

function toPosition(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (Number.isFinite(parsed) && parsed >= 0) return Math.floor(parsed)
  return fallback
}

async function getAxios() {
  const { default: axios } = await import('axios')
  return axios
}

function hasValidLifetime(token: string, minValidityMs = 10_000): boolean {
  if (typeof window === 'undefined' || typeof window.atob !== 'function') return true

  const encodedPayload = token.split('.')[1]
  if (!encodedPayload) return true

  try {
    const padded = encodedPayload
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(encodedPayload.length / 4) * 4, '=')

    const payload = JSON.parse(window.atob(padded))
    const exp = typeof payload?.exp === 'number' ? payload.exp : null
    if (!exp) return true
    return exp * 1000 - Date.now() > minValidityMs
  } catch {
    return true
  }
}

async function readFreshTokenFromClerkRuntime(): Promise<string | null> {
  if (typeof window === 'undefined') return null

  const clerk = (window as Window & {
    Clerk?: {
      session?: {
        getToken?: () => Promise<string | null>
      }
    }
  }).Clerk

  const getSessionToken = clerk?.session?.getToken
  if (typeof getSessionToken !== 'function') return null

  try {
    const token = (await getSessionToken())?.trim() ?? ''
    if (!token || !hasValidLifetime(token)) return null
    clerkToken.value = token
    return token
  } catch {
    return null
  }
}

async function getAuthToken(): Promise<string | null> {
  const fromStore = (clerkToken.value ?? '').trim()
  if (fromStore && hasValidLifetime(fromStore)) return fromStore
  if (fromStore) clerkToken.value = null
  return readFreshTokenFromClerkRuntime()
}

function buildAuthHeaders(token: string | null) {
  return token ? { Authorization: `Bearer ${token}` } : undefined
}

async function postProtected<T>(path: string, payload: unknown): Promise<T> {
  if (!isApiImageStorageEnabled()) {
    throw new Error('ImageKit upload is disabled outside API mode.')
  }

  const token = await getAuthToken()
  if (!token) {
    throw new Error('Session expirée. Reconnectez-vous puis réessayez.')
  }

  const axios = await getAxios()
  const url = resolveUrl(buildApiUrl(path))
  const { data } = await axios.post<T>(url, payload, {
    withCredentials: false,
    timeout: API_REQUEST_TIMEOUT_MS,
    headers: buildAuthHeaders(token),
  })
  return data
}

function normalizeImageKitUrl(rawUrl: unknown): string {
  const value = normalizeTrimmedString(rawUrl)
  if (!value) return ''
  return value
}

function normalizeImportImage(
  image: unknown,
  index: number,
): ImageKitCopyInput | null {
  if (!image || typeof image !== 'object' || Array.isArray(image)) return null
  const record = image as Record<string, unknown>
  const src = normalizeTrimmedString(record.src)
  if (!src) return null
  const alt = normalizeTrimmedString(record.alt)
  const position = toPosition(record.position, index)
  return {
    ...(record as ImageKitCopyInput),
    src,
    alt: alt || undefined,
    position,
  }
}

async function uploadDataUrlImageToImageKit(
  fileData: string,
  options?: UploadImageOptions & { fallbackBaseName?: string },
): Promise<string> {
  const trimmedFileData = normalizeTrimmedString(fileData)
  if (!trimmedFileData) {
    throw new Error('Image source is empty.')
  }

  const fallbackExtension = extensionFromDataUrl(trimmedFileData) ?? 'webp'
  const fallbackBaseName = normalizeListingId(options?.fallbackBaseName ?? '') || `image-${Date.now()}`
  assertCanUploadToImageKit(options)
  const fileName = sanitizeFileName(
    options?.fileName ?? `${fallbackBaseName}.${fallbackExtension}`,
    fallbackBaseName,
    fallbackExtension,
  )
  const folder = options?.folder?.trim() || resolveImageFolder({
    listingId: options?.listingId,
    category: 'gallery',
  })

  const response = await postProtected<ApiUploadResponse>(IMAGEKIT_UPLOAD_PATH, {
    fileData: trimmedFileData,
    fileName,
    folder,
    useUniqueFileName: true,
  })

  const uploadedUrl = normalizeImageKitUrl(response.image?.url)
  if (!uploadedUrl) {
    throw new Error("ImageKit n'a pas renvoyé d'URL valide.")
  }
  return uploadedUrl
}

export function isApiImageStorageEnabled(): boolean {
  return LISTINGS_MODE === 'api' && Boolean(BASE_API_URL)
}

export function isImageKitHostedUrl(src: unknown): boolean {
  const value = normalizeTrimmedString(src)
  if (!value || !/^https?:\/\//i.test(value)) return false

  if (IMAGEKIT_ENDPOINT && value.startsWith(IMAGEKIT_ENDPOINT)) return true

  try {
    const parsed = new URL(value)
    return /(^|\.)imagekit\.io$/i.test(parsed.hostname)
  } catch {
    return value.includes('imagekit.io/')
  }
}

export async function uploadGalleryImageToImageKit(
  file: File,
  options?: UploadImageOptions,
): Promise<{ url: string; fileId: string | null; filePath: string | null; name: string | null }> {
  if (!isApiImageStorageEnabled()) {
    throw new Error('ImageKit upload is disabled outside API mode.')
  }

  assertCanUploadToImageKit(options)
  const optimizedDataUrl = await readOptimizedImageDataUrl(file, {
    maxDimension: 2560,
    preferredMimeType: 'image/webp',
    quality: 0.86,
  })

  const extension = extensionFromDataUrl(optimizedDataUrl)
    ?? extensionFromFileName(file.name)
    ?? extensionFromMimeType(file.type)
    ?? 'webp'

  const fallbackBaseName = normalizeListingId(file.name.replace(/\.[^/.]+$/, '')) || `gallery-${Date.now()}`
  const fileName = sanitizeFileName(options?.fileName ?? file.name, fallbackBaseName, extension)
  const folder = options?.folder?.trim() || resolveImageFolder({
    listingId: options?.listingId,
    category: 'gallery',
  })

  const response = await postProtected<ApiUploadResponse>(IMAGEKIT_UPLOAD_PATH, {
    fileData: optimizedDataUrl,
    fileName,
    folder,
    useUniqueFileName: true,
  })

  const url = normalizeImageKitUrl(response.image?.url)
  if (!url) {
    throw new Error("ImageKit n'a pas renvoyé d'URL valide.")
  }

  return {
    url,
    fileId: normalizeTrimmedString(response.image?.fileId) || null,
    filePath: normalizeTrimmedString(response.image?.filePath) || null,
    name: normalizeTrimmedString(response.image?.name) || null,
  }
}

export async function copyScrapedImagesToImageKit(
  images: ImageKitCopyInput[],
  options?: { listingId?: string | null; listingStatus?: string | null; folder?: string },
): Promise<ImageKitCopyInput[]> {
  if (!isApiImageStorageEnabled()) return images
  if (!Array.isArray(images) || !images.length) return images
  assertCanUploadToImageKit({
    listingId: options?.listingId,
    listingStatus: options?.listingStatus,
    folder: options?.folder,
  })

  const normalized = images
    .map((image, index) => normalizeImportImage(image, index))
    .filter((image): image is ImageKitCopyInput => Boolean(image))
    .sort((a, b) => toPosition(a.position, 0) - toPosition(b.position, 0))

  if (!normalized.length) return []

  const indexesToImport = normalized
    .map((image, index) => ({
      image,
      index,
    }))
    .filter(({ image }) => /^https?:\/\//i.test(image.src) && !isImageKitHostedUrl(image.src))

  if (!indexesToImport.length) return normalized

  const folder = options?.folder?.trim() || resolveImageFolder({
    listingId: options?.listingId,
    category: 'scraped',
  })

  const response = await postProtected<ApiImportResponse>(IMAGEKIT_IMPORT_PATH, {
    images: indexesToImport.map(({ image, index }) => ({
      url: image.src,
      fileName: inferRemoteFileName(image.src, index),
      alt: normalizeTrimmedString(image.alt),
      position: toPosition(image.position, index),
    })),
    folder,
    useUniqueFileName: true,
  })

  const imported = Array.isArray(response.images) ? response.images : []
  const next = [
    ...normalized,
  ]

  for (let i = 0; i < indexesToImport.length; i += 1) {
    const target = indexesToImport[i]
    if (!target) continue
    const importedItem = imported[i]
    const uploadedUrl = normalizeImageKitUrl(importedItem?.url)
    if (!uploadedUrl) continue
    const current = next[target.index]
    if (!current) continue
    next[target.index] = {
      ...current,
      src: uploadedUrl,
    }
  }

  const importErrors = imported
    .map((item) => normalizeTrimmedString(item?.error))
    .filter(Boolean)

  if (importErrors.length) {
    console.warn('[ImageKit] some scraped images could not be copied', {
      count: importErrors.length,
      firstError: importErrors[0],
    })
  }

  return next
}

export async function ensurePublishedMediasStoredInImageKit(
  medias: Partial<RawMedias> | null | undefined,
  options?: { listingId?: string | null; listingStatus?: string | null },
): Promise<Partial<RawMedias> | null | undefined> {
  if (!isApiImageStorageEnabled()) return medias
  if (!medias || typeof medias !== 'object' || Array.isArray(medias)) return medias
  if (!isPublishedStatus(options?.listingStatus)) return medias

  const sourceImages = Array.isArray(medias.images)
    ? medias.images.map((image, index) => normalizeImportImage(image, index)).filter((image): image is ImageKitCopyInput => Boolean(image))
    : []

  if (!sourceImages.length) return medias

  let nextImages = await copyScrapedImagesToImageKit(sourceImages, {
    listingId: options?.listingId,
    listingStatus: options?.listingStatus,
  })

  const dataUrlCandidates = nextImages
    .map((image, index) => ({
      image,
      index,
    }))
    .filter(({ image }) => image.src.startsWith('data:'))

  if (dataUrlCandidates.length) {
    const uploads = await Promise.all(
      dataUrlCandidates.map(async ({ image, index }) => {
        const uploadedUrl = await uploadDataUrlImageToImageKit(image.src, {
          listingId: options?.listingId,
          listingStatus: options?.listingStatus,
          fallbackBaseName: `image-${index + 1}`,
          fileName: `image-${index + 1}.${extensionFromDataUrl(image.src) ?? 'webp'}`,
        })
        return {
          index,
          uploadedUrl,
        }
      }),
    )

    const uploadedByIndex = new Map<number, string>(
      uploads.map((item): [number, string] => [
        item.index,
        item.uploadedUrl,
      ]),
    )

    nextImages = nextImages.map((image, index) => {
      const uploadedUrl = uploadedByIndex.get(index)
      if (!uploadedUrl) return image
      return {
        ...image,
        src: uploadedUrl,
      }
    })
  }

  return {
    ...medias,
    images: nextImages,
  } as Partial<RawMedias>
}
