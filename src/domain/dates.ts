import type { DateRange, PeriodPreset } from './types'

export function todayISO(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map((n) => Number.parseInt(n, 10))
  return new Date(y, (m || 1) - 1, d || 1)
}

export function formatISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDaysISO(iso: string, days: number): string {
  const dt = parseISODate(iso)
  dt.setDate(dt.getDate() + days)
  return formatISODate(dt)
}

export function daysInMonth(year: number, month1To12: number): number {
  return new Date(year, month1To12, 0).getDate()
}

export function addMonthsClamped(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map((n) => Number.parseInt(n, 10))
  const totalMonths = y * 12 + (m - 1) + months
  const nextY = Math.floor(totalMonths / 12)
  const nextM = ((totalMonths % 12) + 12) % 12 + 1
  const clampedD = Math.min(d, daysInMonth(nextY, nextM))
  return `${nextY}-${String(nextM).padStart(2, '0')}-${String(clampedD).padStart(2, '0')}`
}

export function diffDaysISO(fromISO: string, toISO: string): number {
  const a = parseISODate(fromISO)
  const b = parseISODate(toISO)
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((utcB - utcA) / 86_400_000)
}

/** Monday-first week start (YYYY-MM-DD). */
export function startOfWeekISO(iso: string): string {
  const dt = parseISODate(iso)
  const day = dt.getDay() // 0 Sun .. 6 Sat
  const offset = day === 0 ? -6 : 1 - day
  dt.setDate(dt.getDate() + offset)
  return formatISODate(dt)
}

export function getWeekDates(anchorISO: string): string[] {
  const start = startOfWeekISO(anchorISO)
  return Array.from({ length: 7 }, (_, i) => addDaysISO(start, i))
}

export function getMonthGridDates(year: number, monthIndex0: number): string[] {
  const firstOfMonth = new Date(year, monthIndex0, 1)
  const firstISO = formatISODate(firstOfMonth)
  const gridStart = startOfWeekISO(firstISO)
  const lastDay = daysInMonth(year, monthIndex0 + 1)
  const lastISO = `${year}-${String(monthIndex0 + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const totalDaysFromStart = diffDaysISO(gridStart, lastISO) + 1
  const weeks = Math.ceil(totalDaysFromStart / 7)
  const totalCells = weeks * 7
  return Array.from({ length: totalCells }, (_, i) => addDaysISO(gridStart, i))
}

export function isWithinRange(iso: string, range: DateRange): boolean {
  return iso >= range.start && iso <= range.end
}

export function resolvePeriodRange(
  preset: PeriodPreset,
  today: string,
  customStart?: string,
  customEnd?: string,
): DateRange {
  switch (preset) {
    case 'this_week': {
      const start = startOfWeekISO(today)
      return { start, end: addDaysISO(start, 6) }
    }
    case 'this_month': {
      const [y, m] = today.split('-').map((n) => Number.parseInt(n, 10))
      const start = `${y}-${String(m).padStart(2, '0')}-01`
      const end = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth(y, m)).padStart(2, '0')}`
      return { start, end }
    }
    case 'last_month': {
      const prev = addMonthsClamped(`${today.slice(0, 7)}-01`, -1)
      const [y, m] = prev.split('-').map((n) => Number.parseInt(n, 10))
      const start = `${y}-${String(m).padStart(2, '0')}-01`
      const end = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth(y, m)).padStart(2, '0')}`
      return { start, end }
    }
    case 'last_90_days': {
      return { start: addDaysISO(today, -89), end: today }
    }
    case 'custom': {
      const s = customStart && /^\d{4}-\d{2}-\d{2}$/.test(customStart) ? customStart : today
      const e = customEnd && /^\d{4}-\d{2}-\d{2}$/.test(customEnd) ? customEnd : today
      return s <= e ? { start: s, end: e } : { start: e, end: s }
    }
    case 'all_time':
    default:
      return { start: '1970-01-01', end: '2999-12-31' }
  }
}

export function formatShortDate(iso: string): string {
  const dt = parseISODate(iso)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(dt)
}

export function formatTimeEnd(startTime: string, durationMin: number): string {
  const [hStr, mStr] = startTime.split(':')
  const h = Number.parseInt(hStr || '0', 10)
  const m = Number.parseInt(mStr || '0', 10)
  const total = h * 60 + m + Math.max(0, durationMin)
  const endH = Math.floor(total / 60) % 24
  const endM = total % 60
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
}

export function formatDuration(minutes: number): string {
  const mins = Math.max(0, Math.round(minutes))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}
