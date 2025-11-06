// File: src/views/ListingView/components/ListingCore/components/DatePicker/helpers/date.ts

// Utils de dates "purs" (format/parse)

import { CalendarDate } from '@internationalized/date'
import type { DateValue } from '@internationalized/date'

export type ISO = string
export type RangeISO = { start: ISO; end: ISO }

export const toNum = (d: { year: number; month: number; day: number }) =>
  d.year * 10000 + d.month * 100 + d.day

export const parseISO = (iso: ISO) => {
  const [y, m, dd] = iso.split('-').map(Number)
  return new CalendarDate(y, m, dd)
}

const fmt2 = (n: number) => String(n).padStart(2, '0')

export const toISO = (d?: DateValue | null): ISO =>
  d ? `${d.year}-${fmt2(d.month)}-${fmt2(d.day)}` : ''

export const todayCalendarDate = () => {
  const now = new Date()
  return new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}
