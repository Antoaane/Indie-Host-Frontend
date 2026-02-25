// File: src/views/ListingView/utils/formatters.ts

export function formatRatingValue(
  value: number | null | undefined,
  locale = 'fr-FR',
  options: Intl.NumberFormatOptions = {},
): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—'
  }

  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  })

  return formatter.format(value)
}

export function formatStayPeriodLabel(
  range: { start?: string; end?: string } | undefined,
  template: string,
  locale = 'fr-FR',
): string {
  if (!range?.start || !range?.end) {
    return ''
  }

  const start = new Date(range.start)
  const end = new Date(range.end)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return ''
  }

  const formatter = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const formattedStart = formatter.format(start)
  const formattedEnd = formatter.format(end)

  return template
    .replace('{start}', formattedStart)
    .replace('{end}', formattedEnd)
}

export function buildDistributionFromComments(comments: Array<{ note: number }>): Record<string, number> {
  return comments.reduce<Record<string, number>>((acc, comment) => {
    const rating = Math.round(comment.note)

    if (!Number.isFinite(rating)) {
      return acc
    }

    const key = String(rating)
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
}

export function computePercentage(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) {
    return 0
  }

  const ratio = (value / total) * 100

  if (ratio < 0) return 0
  if (ratio > 100) return 100

  return Math.round(ratio)
}
