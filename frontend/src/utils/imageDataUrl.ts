// File: src/utils/imageDataUrl.ts

const DEFAULT_MAX_DIMENSION = 2560
const DEFAULT_QUALITY = 0.86

const ALLOWED_OUTPUT_MIME_TYPES = new Set([
  'image/webp',
  'image/jpeg',
  'image/png',
])

type OptimizeImageDataUrlOptions = {
  maxDimension?: number
  preferredMimeType?: string
  quality?: number
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function normalizeQuality(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(1, Math.max(0.1, parsed))
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Unable to load image file'))
    }

    image.src = objectUrl
  })
}

function resolveOutputMimeType(preferredMimeType: unknown, sourceMimeType: unknown): string {
  const preferred = typeof preferredMimeType === 'string' ? preferredMimeType.trim().toLowerCase() : ''
  if (preferred && ALLOWED_OUTPUT_MIME_TYPES.has(preferred)) return preferred

  const source = typeof sourceMimeType === 'string' ? sourceMimeType.trim().toLowerCase() : ''
  if (source && ALLOWED_OUTPUT_MIME_TYPES.has(source)) return source

  return 'image/webp'
}

function createCanvasFromImage(image: HTMLImageElement, maxDimension: number): HTMLCanvasElement {
  const sourceWidth = Math.max(1, image.naturalWidth || image.width || 1)
  const sourceHeight = Math.max(1, image.naturalHeight || image.height || 1)
  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight))

  const targetWidth = Math.max(1, Math.round(sourceWidth * scale))
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight

  const context = canvas.getContext('2d')
  if (!context) return canvas

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, targetWidth, targetHeight)

  return canvas
}

function exportCanvasDataUrl(canvas: HTMLCanvasElement, mimeType: string, quality: number): string {
  try {
    const dataUrl = canvas.toDataURL(mimeType, quality)
    if (!dataUrl || dataUrl === 'data:,') return ''
    return dataUrl
  } catch {
    return ''
  }
}

export async function readOptimizedImageDataUrl(file: File, options?: OptimizeImageDataUrlOptions): Promise<string> {
  const maxDimension = normalizePositiveNumber(options?.maxDimension, DEFAULT_MAX_DIMENSION)
  const quality = normalizeQuality(options?.quality, DEFAULT_QUALITY)
  const primaryMimeType = resolveOutputMimeType(options?.preferredMimeType, file.type)

  try {
    const image = await loadImageFromFile(file)
    const canvas = createCanvasFromImage(image, maxDimension)

    const primaryDataUrl = exportCanvasDataUrl(canvas, primaryMimeType, quality)
    if (primaryDataUrl) return primaryDataUrl

    const fallbackMimeType = primaryMimeType === 'image/jpeg' ? 'image/webp' : 'image/jpeg'
    const fallbackDataUrl = exportCanvasDataUrl(canvas, fallbackMimeType, quality)
    if (fallbackDataUrl) return fallbackDataUrl
  } catch {
    // ignore and fallback to original image payload
  }

  return readFileAsDataUrl(file)
}
