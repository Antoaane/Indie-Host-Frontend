// File: src/views/Admin/adminFormat.ts

// Mise en forme commune aux écrans de l'administration : montants, dates, états.

import type { AdminPaymentStatus, ServiceStatus } from '@/domain/api/admin'

export type Tone = 'good' | 'warn' | 'bad' | 'muted'

export function formatMoney(amountMinor: number, currency = 'eur'): string {
  const amount = amountMinor / 100
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value)
}

/**
 * Disponibilité en pourcentage, arrondie vers le bas au dixième : 99,96 % s'écrit 99,9 %, jamais
 * 100 % (« 100 % » ne s'affiche que sans aucune panne mesurée).
 */
export function formatPercent(ratio: number): string {
  if (ratio >= 1) return '100 %'
  const percent = Math.floor(Math.max(0, ratio) * 1000) / 10
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(percent)} %`
}

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(iso: string | null | undefined): string {
  const date = toDate(iso)
  if (!date) return '—'
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

export function formatDateTime(iso: string | null | undefined): string {
  const date = toDate(iso)
  if (!date) return '—'
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatTime(iso: string | null | undefined): string {
  const date = toDate(iso)
  if (!date) return '—'
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(date)
}

/** « il y a 12 s », « il y a 3 min », « il y a 2 h », puis la date. */
export function formatAgo(iso: string | null | undefined, now = Date.now()): string {
  const date = toDate(iso)
  if (!date) return 'jamais'
  const seconds = Math.max(0, Math.round((now - date.getTime()) / 1000))
  if (seconds < 5) return 'à l’instant'
  if (seconds < 60) return `il y a ${seconds} s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  return `le ${formatDate(iso)}`
}

export function formatEvery(ms: number): string {
  if (ms < 60_000) return `toutes les ${Math.round(ms / 1000)} s`
  const minutes = Math.round(ms / 60_000)
  return minutes === 1 ? 'chaque minute' : `toutes les ${minutes} min`
}

export const SERVICE_STATUS: Record<ServiceStatus, { label: string; tone: Tone }> = {
  up: { label: 'En service', tone: 'good' },
  degraded: { label: 'À surveiller', tone: 'warn' },
  down: { label: 'En panne', tone: 'bad' },
  disabled: { label: 'Non configuré', tone: 'muted' },
  unknown: { label: 'Mesure en cours', tone: 'muted' },
}

export const PAYMENT_STATUS: Record<AdminPaymentStatus, { label: string; tone: Tone }> = {
  succeeded: { label: 'Réussi', tone: 'good' },
  failed: { label: 'Refusé', tone: 'bad' },
  pending: { label: 'En cours', tone: 'warn' },
  refunded: { label: 'Remboursé', tone: 'warn' },
  partially_refunded: { label: 'Remboursé en partie', tone: 'warn' },
  disputed: { label: 'Litige', tone: 'bad' },
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${formatCount(count)} ${count > 1 ? plural : singular}`
}
