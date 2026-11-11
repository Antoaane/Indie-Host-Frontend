// File: src/views/ListingView/components/Booking/utils/labels.ts

import type { RangeISO } from '@/components/DatePicker/helpers/date'
import type { OccupantCounts } from '@/views/ListingView/types/reservation'

export type { OccupantCounts }

export function buildOccupantLabel(occupants: OccupantCounts, travelerCount: number) {
  const parts: string[] = []
  if (travelerCount) parts.push(`${travelerCount} voyageur${travelerCount > 1 ? 's' : ''}`)
  if (occupants.children) parts.push(`${occupants.children} enfant${occupants.children > 1 ? 's' : ''}`)
  if (occupants.babies) parts.push(`${occupants.babies} bébé${occupants.babies > 1 ? 's' : ''}`)
  if (occupants.animals) parts.push(`${occupants.animals} animal${occupants.animals > 1 ? 's' : ''} de compagnie`)
  if (occupants.pmr) parts.push(`${occupants.pmr} personne${occupants.pmr > 1 ? 's' : ''} PMR`)
  return parts.length ? parts.join(', ') : 'Ajouter des voyageurs'
}

// Un jour « AAAA-MM-JJ » est une date de calendrier, pas un instant : lu et écrit en UTC. Lu dans le
// fuseau du téléphone, « 2026-11-11 » s'affichait « 10/11/2026 » pour un voyageur aux Antilles.
function parseDay(iso?: string | null): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? '').trim())
  if (!match) return null
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDateLabel(iso?: string | null) {
  const date = parseDay(iso)
  if (!date) return 'Ajouter une date'
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(date)
}

export function formatShortDateLabel(iso?: string | null) {
  const date = parseDay(iso)
  if (!date) return 'Ajouter une date'
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' }).format(date)
}

/** « mer. 11 nov. » (avec l'année quand ce n'est pas l'année en cours). */
export function formatStayDay(iso?: string | null): string | null {
  const date = parseDay(iso)
  if (!date) return null
  const sameYear = date.getUTCFullYear() === new Date().getFullYear()
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  }).format(date)
}

/** « 11 – 13 nov. », « 28 nov. – 2 déc. » : le séjour en une ligne courte. */
export function formatStayRange(range: RangeISO | null): string | null {
  const start = parseDay(range?.start)
  const end = parseDay(range?.end)
  if (!start || !end || end <= start) return null

  const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  const dayOnly = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', timeZone: 'UTC' })
  const sameMonth = start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth()
  return sameMonth
    ? `${dayOnly.format(start)} – ${dayMonth.format(end)}`
    : `${dayMonth.format(start)} – ${dayMonth.format(end)}`
}

export function buildRangeLabel(selection: RangeISO | null, nights: number) {
  if (!selection?.start || !selection?.end || nights <= 0) return 'Sélectionnez vos dates'
  return `
  <span>Du <strong>${formatDateLabel(selection.start)}</strong></span>
  <span class="line">|</span>
  <span>au <strong>${formatDateLabel(selection.end)}</strong></span>
  `
}
