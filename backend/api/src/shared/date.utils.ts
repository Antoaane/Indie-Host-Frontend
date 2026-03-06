const DAY_MS = 24 * 60 * 60 * 1000

export function toUtcDay(isoDate: string): number | null {
  if (typeof isoDate !== 'string' || !isoDate.trim()) return null
  const dateOnly = isoDate.slice(0, 10)
  const parsed = Date.parse(`${dateOnly}T00:00:00.000Z`)
  return Number.isFinite(parsed) ? parsed : null
}

export function nightsBetween(startISO: string, endISO: string): number {
  const start = toUtcDay(startISO)
  const end = toUtcDay(endISO)
  if (start === null || end === null || end <= start) return 0
  return Math.max(0, Math.round((end - start) / DAY_MS))
}

export function normalizeDateRange(startISO: string, endISO: string): { startISO: string; endISO: string } {
  const start = startISO.slice(0, 10)
  const end = endISO.slice(0, 10)
  return { startISO: start, endISO: end }
}

export function toDateAtUtcMidnight(isoDate: string): Date {
  const normalized = isoDate.slice(0, 10)
  return new Date(`${normalized}T00:00:00.000Z`)
}

export function toDateAtUtcNoon(isoDate: string): Date {
  const normalized = isoDate.slice(0, 10)
  return new Date(`${normalized}T12:00:00.000Z`)
}
