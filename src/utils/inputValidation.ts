// File: src/utils/inputValidation.ts

export function normalizeTextInput(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  return value.slice(0, Math.max(0, maxLength))
}

export function clampInteger(value: unknown, min: number, max: number, fallback = min): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

export function clampNumber(value: unknown, min: number, max: number, fallback = min): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

export function parseOptionalInteger(raw: string, min: number, max: number): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return null
  return clampInteger(parsed, min, max)
}

export function stripHtmlToText(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function plainTextLengthFromHtml(value: string): number {
  return stripHtmlToText(value).length
}

export function formatValidationMessage(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) return match
    return String(values[key])
  })
}

export type ImageValidationResult =
  | { valid: true }
  | { valid: false; message: string }

export type GalleryValidationConfig = {
  acceptedMimeTypes: readonly string[]
  maxFileSizeBytes: number
  minWidth: number
  minHeight: number
  maxWidth: number
  maxHeight: number
  messages: {
    invalidMime: string
    maxFileSize: string
    minDimensions: string
    maxDimensions: string
    unreadable: string
  }
}

function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1)
}

function mimeToLabel(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'JPG'
  if (mimeType === 'image/png') return 'PNG'
  if (mimeType === 'image/webp') return 'WEBP'
  if (mimeType === 'image/avif') return 'AVIF'

  const [
    ,
    subtype,
  ] = mimeType.split('/')
  return subtype ? subtype.toUpperCase() : mimeType.toUpperCase()
}

export function humanizeGalleryMimeTypes(mimeTypes: readonly string[]): string {
  return mimeTypes.map((mimeType) => mimeToLabel(mimeType)).join(', ')
}

async function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return await new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(objectUrl)
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Impossible de lire les dimensions de l’image.'))
    }

    img.src = objectUrl
  })
}

export async function validateGalleryImageFile(
  file: File,
  config: GalleryValidationConfig,
): Promise<ImageValidationResult> {
  const accepted = config.acceptedMimeTypes
  const formatsReadable = humanizeGalleryMimeTypes(config.acceptedMimeTypes)
  const templateValues = {
    formatsReadable,
    maxSizeMb: formatMb(config.maxFileSizeBytes),
    minWidth: config.minWidth,
    minHeight: config.minHeight,
    maxWidth: config.maxWidth,
    maxHeight: config.maxHeight,
  }

  if (!accepted.includes(file.type)) {
    return {
      valid: false,
      message: formatValidationMessage(config.messages.invalidMime, templateValues),
    }
  }

  if (file.size > config.maxFileSizeBytes) {
    return {
      valid: false,
      message: formatValidationMessage(config.messages.maxFileSize, templateValues),
    }
  }

  try {
    const { width, height } = await readImageDimensions(file)
    if (width < config.minWidth || height < config.minHeight) {
      return {
        valid: false,
        message: formatValidationMessage(config.messages.minDimensions, templateValues),
      }
    }
    if (width > config.maxWidth || height > config.maxHeight) {
      return {
        valid: false,
        message: formatValidationMessage(config.messages.maxDimensions, templateValues),
      }
    }
  } catch {
    return {
      valid: false,
      message: formatValidationMessage(config.messages.unreadable, templateValues),
    }
  }

  return { valid: true }
}

export function acceptedGalleryMimeTypes(mimeTypes: readonly string[]): string {
  return mimeTypes.join(',')
}
