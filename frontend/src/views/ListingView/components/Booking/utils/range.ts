// File: src/views/ListingView/components/Booking/utils/range.ts

import type { RangeISO } from '@/components/DatePicker/helpers/date'
import { parseISO, todayCalendarDate, toISO } from '@/components/DatePicker/helpers/date'

type CalendarDateLike = ReturnType<typeof todayCalendarDate>
type DisableDateFn = (date: CalendarDateLike) => boolean

export function addDays(date: CalendarDateLike, days: number) {
  return date.add({ days })
}

export function isRangeAvailable(start: CalendarDateLike, nights: number, isDateDisabled: DisableDateFn) {
  for (let offset = 0; offset <= nights; offset += 1) {
    const candidate = addDays(start, offset)
    if (isDateDisabled(candidate)) return false
  }
  return true
}

export function findNextRange(minNights: number, isDateDisabled: DisableDateFn): RangeISO | null {
  const base = todayCalendarDate()
  for (let offset = 0; offset < 365 * 2; offset += 1) {
    const start = addDays(base, offset)
    if (isRangeAvailable(start, minNights, isDateDisabled)) {
      const end = addDays(start, minNights)
      return { start: toISO(start), end: toISO(end) }
    }
  }
  return null
}

export function isSelectedRangeValid(selection: RangeISO | null, nights: number, isDateDisabled: DisableDateFn) {
  if (!selection?.start || !selection?.end) return false
  if (!nights) return false
  const start = parseISO(selection.start)
  return isRangeAvailable(start, nights, isDateDisabled)
}
