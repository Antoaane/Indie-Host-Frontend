// File: src/components/DatePicker/utils/range.ts

import type { RangeISO } from '@/components/DatePicker/helpers/date'
import { parseISO, toNum, todayCalendarDate } from '@/components/DatePicker/helpers/date'

/** Convertit les ranges ISO en bornes numériques triées */
export const buildNumericRanges = (ranges: RangeISO[]) =>
  ranges.map(({ start, end }) => {
    const a = toNum(parseISO(start))
    const b = toNum(parseISO(end))
    return a <= b ? { start: a, end: b } : { start: b, end: a }
  })

/** Fabrique une fonction isDisabled qui:
 *  - désactive les ranges fournis
 *  - interdit toute date < aujourd'hui (inclus)
 *  - interdit toute date après `lastDate` (fin de la fenêtre de réservation de l'annonce)
 */
export const makeIsDateDisabled = (ranges: RangeISO[], options?: { allowPast?: boolean; lastDate?: string | null }) => {
  const numeric = buildNumericRanges(ranges)
  const todayNum = toNum(todayCalendarDate())
  const lastNum = options?.lastDate ? toNum(parseISO(options.lastDate)) : null

  return (date: { year: number; month: number; day: number }) => {
    const n = toNum(date)
    if (!options?.allowPast && n < todayNum) return true
    if (lastNum !== null && n > lastNum) return true
    return numeric.some(r => n >= r.start && n <= r.end)
  }
}
