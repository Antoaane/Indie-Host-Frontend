// File: src/domain/api/listingReviews.ts
// Avis voyageur déposé depuis le guide d'arrivée : protégé par la clé de guide (`rg.…`), sans compte.

export type GuideReview = {
  id: string
  reservationId: string
  createdAt: string
  rating: number
  text: string
  author: string
  stayDates: { start: string; end: string }
}

export type GuideReviewStatus = {
  reservationId: string
  listingId: string
  availableFromISO: string
  canReview: boolean
  review: GuideReview | null
}

export type GuideReviewErrorCode =
  | 'REVIEW_ALREADY_EXISTS'
  | 'REVIEW_LOCKED'
  | 'RATE_LIMITED'
  | 'INVALID_GUIDE_KEY'
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'UNKNOWN'

export class GuideReviewError extends Error {
  readonly code: GuideReviewErrorCode
  readonly status: number | null

  constructor(message: string, code: GuideReviewErrorCode, status: number | null) {
    super(message)
    this.name = 'GuideReviewError'
    this.code = code
    this.status = status
  }
}

const BASE_API_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/$/, '')

function resolveUrl(url: string): string {
  if (typeof window === 'undefined') return url
  return new URL(url, window.location.origin).toString()
}

function buildGuideReviewUrl(guideKey: string): string {
  return resolveUrl(`${BASE_API_URL}/listings/guides/${encodeURIComponent(guideKey.trim())}/review`)
}

async function getAxios() {
  const { default: axios } = await import('axios')
  return axios
}

function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeReview(raw: unknown): GuideReview | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const stayDates = (source.stayDates && typeof source.stayDates === 'object')
    ? source.stayDates as Record<string, unknown>
    : {}
  const rating = Number(source.rating)

  return {
    id: toTrimmedString(source.id),
    reservationId: toTrimmedString(source.reservationId),
    createdAt: toTrimmedString(source.createdAt),
    rating: Number.isFinite(rating) ? Math.min(5, Math.max(1, Math.round(rating))) : 5,
    text: toTrimmedString(source.text),
    author: toTrimmedString(source.author),
    stayDates: {
      start: toTrimmedString(stayDates.start),
      end: toTrimmedString(stayDates.end),
    },
  }
}

function normalizeStatus(raw: Record<string, unknown>): GuideReviewStatus {
  return {
    reservationId: toTrimmedString(raw.reservationId),
    listingId: toTrimmedString(raw.listingId),
    availableFromISO: toTrimmedString(raw.availableFromISO),
    canReview: raw.canReview === true,
    review: normalizeReview(raw.review),
  }
}

function toGuideReviewError(error: unknown, fallback: string): GuideReviewError {
  const response = (error && typeof error === 'object')
    ? (error as { response?: { status?: unknown; data?: unknown } }).response
    : undefined
  const status = typeof response?.status === 'number' ? response.status : null
  const data = (response?.data && typeof response.data === 'object') ? response.data as Record<string, unknown> : {}
  const serverCode = toTrimmedString(data.code)
  const serverMessage = toTrimmedString(data.message)

  let code: GuideReviewErrorCode = 'UNKNOWN'
  if (serverCode === 'REVIEW_ALREADY_EXISTS' || status === 409) code = 'REVIEW_ALREADY_EXISTS'
  else if (serverCode === 'REVIEW_LOCKED' || status === 423) code = 'REVIEW_LOCKED'
  else if (status === 429) code = 'RATE_LIMITED'
  else if (status === 403) code = 'INVALID_GUIDE_KEY'
  else if (status === 404) code = 'NOT_FOUND'
  else if (status === 400) code = 'INVALID_INPUT'

  return new GuideReviewError(serverMessage || fallback, code, status)
}

export async function fetchGuideReviewStatus(input: { guideKey: string }): Promise<GuideReviewStatus> {
  const guideKey = input.guideKey.trim()
  if (!guideKey) throw new GuideReviewError('Identifiant du guide manquant.', 'INVALID_GUIDE_KEY', null)

  const axios = await getAxios()
  try {
    const { data } = await axios.get<Record<string, unknown>>(buildGuideReviewUrl(guideKey), { withCredentials: false })
    return normalizeStatus(data ?? {})
  } catch (error) {
    throw toGuideReviewError(error, 'Impossible de vérifier votre avis pour le moment.')
  }
}

export async function submitGuideReview(input: {
  guideKey: string
  rating: number
  text: string
  author?: string
}): Promise<GuideReview> {
  const guideKey = input.guideKey.trim()
  if (!guideKey) throw new GuideReviewError('Identifiant du guide manquant.', 'INVALID_GUIDE_KEY', null)

  const axios = await getAxios()
  try {
    const { data } = await axios.post<Record<string, unknown>>(
      buildGuideReviewUrl(guideKey),
      {
        rating: input.rating,
        text: input.text,
        author: input.author?.trim() || undefined,
      },
      { withCredentials: false },
    )
    const review = normalizeReview(data?.review)
    if (!review) throw new GuideReviewError('Réponse inattendue du serveur.', 'UNKNOWN', null)
    return review
  } catch (error) {
    if (error instanceof GuideReviewError) throw error
    throw toGuideReviewError(error, 'Impossible d’enregistrer votre avis pour le moment. Réessayez dans quelques instants.')
  }
}
