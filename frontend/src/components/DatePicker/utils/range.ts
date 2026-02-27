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
 */
export const makeIsDateDisabled = (ranges: RangeISO[], options?: { allowPast?: boolean }) => {
  const numeric = buildNumericRanges(ranges)
  const todayNum = toNum(todayCalendarDate())

  return (date: { year: number; month: number; day: number }) => {
    const n = toNum(date)
    if (!options?.allowPast && n < todayNum) return true
    return numeric.some(r => n >= r.start && n <= r.end)
  }
}
