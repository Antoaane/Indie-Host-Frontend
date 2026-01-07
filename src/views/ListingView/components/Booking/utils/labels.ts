// File: src/views/ListingView/components/Booking/utils/labels.ts

import type { RangeISO } from '@/components/DatePicker/helpers/date'

export type OccupantCounts = Record<'adults' | 'children' | 'babies' | 'animals' | 'pmr', number>

export function buildOccupantLabel(occupants: OccupantCounts, travelerCount: number) {
  const parts: string[] = []
  if (travelerCount) parts.push(`${travelerCount} voyageur${travelerCount > 1 ? 's' : ''}`)
  if (occupants.children) parts.push(`${occupants.children} enfant${occupants.children > 1 ? 's' : ''}`)
  if (occupants.babies) parts.push(`${occupants.babies} bébé${occupants.babies > 1 ? 's' : ''}`)
  if (occupants.animals) parts.push(`${occupants.animals} animal${occupants.animals > 1 ? 's' : ''} de compagnie`)
  if (occupants.pmr) parts.push(`${occupants.pmr} personne${occupants.pmr > 1 ? 's' : ''} PMR`)
  return parts.length ? parts.join(', ') : 'Ajouter des voyageurs'
}

export function formatDateLabel(iso?: string | null) {
  if (!iso) return 'Ajouter une date'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Ajouter une date'
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

export function buildRangeLabel(selection: RangeISO | null, nights: number) {
  if (!selection?.start || !selection?.end || nights <= 0) return 'Sélectionnez vos dates'
  return `
  <span>Du <strong>${formatDateLabel(selection.start)}</strong></span>
  <span class="line">|</span>
  <span>au <strong>${formatDateLabel(selection.end)}</strong></span>
  `
}
