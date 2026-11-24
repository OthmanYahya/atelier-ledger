import { useMemo, useState } from 'react'
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  List,
  Plus,
} from 'lucide-react'
import { PaymentBadge } from '../components/Badges'
import { useLedger } from '../context/LedgerContext'
import {
  buildStudentBillingLedgers,
  computeLessonCharge,
} from '../domain/billing'
import {
  addDaysISO,
  addMonthsClamped,
  formatDuration,
  formatShortDate,
  getMonthGridDates,
  getWeekDates,
  parseISODate,
} from '../domain/dates'
import { formatMoney } from '../domain/money'
import { downloadTextFile, exportLessonsCSV } from '../domain/storage'
import type { LessonStatus, PaymentStatus } from '../domain/types'

type SubView = 'calendar' | 'log'
type CalendarSpan = 'week' | 'month'

export function LessonsCalendarView() {
  const { state, today, setDrawer, markLessonPaid } = useLedger()
  const [subView, setSubView] = useState<SubView>('calendar')
  const [calendarSpan, setCalendarSpan] = useState<CalendarSpan>('week')
  const [anchorDate, setAnchorDate] = useState(today)

  // Session log filters
  const [studentFilter, setStudentFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<LessonStatus | 'all'>('all')
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  const cur = state.settings.currency
  const studentMap = useMemo(() => new Map(state.students.map((s) => [s.id, s])), [state.students])

  const { retainerLedgers, packageLedgers } = useMemo(
    () =>
      buildStudentBillingLedgers(
        state.students,
        state.lessons,
        state.retainerPayments,
        today,
      ),
    [state.students, state.lessons, state.retainerPayments, today],
  )

  const weekDates = useMemo(() => getWeekDates(anchorDate), [anchorDate])
  const monthGrid = useMemo(() => {
    const dt = parseISODate(anchorDate)
    return getMonthGridDates(dt.getFullYear(), dt.getMonth())
  }, [anchorDate])

  const lessonsByDate = useMemo(() => {
    const map = new Map<string, typeof state.lessons>()
    for (const l of state.lessons) {
      const list = map.get(l.date) ?? []
      list.push(l)
      map.set(l.date, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime))
    }
    return map
  }, [state.lessons])

  const tasksByDate = useMemo(() => {
    const map = new Map<string, typeof state.tasks>()
    for (const t of state.tasks) {
      if (!t.dueDate || t.status === 'Done') continue
      const list = map.get(t.dueDate) ?? []
      list.push(t)
      map.set(t.dueDate, list)
    }
    return map
  }, [state.tasks])

  const filteredLessons = useMemo(() => {
    const q = search.trim().toLowerCase()
    return state.lessons
      .filter((l) => {
        if (studentFilter !== 'all' && l.studentId !== studentFilter) return false
        if (statusFilter !== 'all' && l.status !== statusFilter) return false
        if (paymentFilter !== 'all' && l.paymentStatus !== paymentFilter) return false
        if (q) {
          const stName = studentMap.get(l.studentId)?.name ?? ''
          if (!`${l.topic} ${stName}`.toLowerCase().includes(q)) return false
        }
        return true
      })
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime))
  }, [state.lessons, studentFilter, statusFilter, paymentFilter, search, studentMap])

  const handleExportCSV = () => {
    const csv = exportLessonsCSV(state.lessons, state.students, state.settings, (l, s) =>
      computeLessonCharge(
        s,
        l,
        s ? retainerLedgers.get(s.id) : undefined,
        s ? packageLedgers.get(s.id) : undefined,
      ).effectivePriceMinor,
    )
    downloadTextFile(`atelier-lessons-${today}.csv`, csv, 'text/csv;charset=utf-8')
  }

  const navigateCalendar = (dir: -1 | 1) => {
    if (calendarSpan === 'week') {
      setAnchorDate((d) => addDaysISO(d, dir * 7))
    } else {
      setAnchorDate((d) => addMonthsClamped(`${d.slice(0, 7)}-01`, dir))
    }
  }

  const headerPeriodLabel =
    calendarSpan === 'week'
      ? `${formatShortDate(weekDates[0])} – ${formatShortDate(weekDates[6])}`
      : new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
          parseISODate(anchorDate),
        )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Lessons &amp; Unified Calendar
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--ink-secondary)' }}>
            Scheduled sessions, completed lessons, and task due dates on one timeline.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-lg border p-0.5"
            style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-rail)' }}
          >
            <button
              type="button"
              onClick={() => setSubView('calendar')}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium"
              style={{
                backgroundColor: subView === 'calendar' ? 'var(--bg-surface)' : 'transparent',
                color: subView === 'calendar' ? 'var(--ink-primary)' : 'var(--ink-secondary)',
              }}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Calendar</span>
            </button>
            <button
              type="button"
              onClick={() => setSubView('log')}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium"
              style={{
                backgroundColor: subView === 'log' ? 'var(--bg-surface)' : 'transparent',
                color: subView === 'log' ? 'var(--ink-primary)' : 'var(--ink-secondary)',
              }}
            >
              <List className="h-3.5 w-3.5" />
              <span>Session Log ({state.lessons.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px]"
          >
            <Download className="h-3.5 w-3.5" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setDrawer({ kind: 'lesson', initialDate: today })}
            className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Log Lesson</span>
          </button>
        </div>
      </div>

      {subView === 'calendar' ? (
        <div className="ledger-sheet overflow-hidden">
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-rail)' }}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigateCalendar(-1)}
                aria-label="Previous period"
                className="btn-secondary p-1.5"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setAnchorDate(today)}
                className="btn-secondary px-2.5 py-1 text-[12px]"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => navigateCalendar(1)}
                aria-label="Next period"
                className="btn-secondary p-1.5"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <span className="tabular-nums ml-2 text-[14px] font-semibold">
                {headerPeriodLabel}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCalendarSpan('week')}
                className="rounded-md border px-2.5 py-1 text-[12px] font-medium"
                style={{
                  backgroundColor: calendarSpan === 'week' ? 'var(--accent)' : 'var(--bg-surface)',
                  color: calendarSpan === 'week' ? 'var(--accent-ink)' : 'var(--ink-secondary)',
                  borderColor: calendarSpan === 'week' ? 'var(--accent)' : 'var(--border)',
                }}
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => setCalendarSpan('month')}
                className="rounded-md border px-2.5 py-1 text-[12px] font-medium"
                style={{
                  backgroundColor: calendarSpan === 'month' ? 'var(--accent)' : 'var(--bg-surface)',
                  color: calendarSpan === 'month' ? 'var(--accent-ink)' : 'var(--ink-secondary)',
                  borderColor: calendarSpan === 'month' ? 'var(--accent)' : 'var(--border)',
                }}
              >
                Month
              </button>
            </div>
          </div>

          {calendarSpan === 'week' ? (
            <div className="grid grid-cols-1 divide-y md:grid-cols-7 md:divide-x md:divide-y-0" style={{ borderColor: 'var(--border)' }}>
              {weekDates.map((iso) => {
                const isToday = iso === today
                const dayLessons = lessonsByDate.get(iso) ?? []
                const dayTasks = tasksByDate.get(iso) ?? []
                const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(
                  parseISODate(iso),
                )
                return (
                  <div
                    key={iso}
                    className="flex min-h-56 flex-col p-2.5"
                    style={{
                      borderColor: 'var(--border)',
                      backgroundColor: isToday ? 'var(--accent-tint)' : 'transparent',
                    }}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="tabular-nums text-[12px] font-semibold">
                        {dayName}{' '}
                        <span style={{ color: isToday ? 'var(--accent)' : 'var(--ink-muted)' }}>
                          {iso.slice(8)}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setDrawer({ kind: 'lesson', initialDate: iso })}
                        aria-label={`Schedule lesson on ${iso}`}
                        className="rounded p-1 hover:bg-black/5"
                        style={{ color: 'var(--ink-muted)' }}
                        title="Schedule lesson"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {dayLessons.map((l) => {
                        const s = studentMap.get(l.studentId)
                        const isCancelled = l.status.startsWith('Cancelled')
                        return (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => setDrawer({ kind: 'lesson', lessonId: l.id })}
                            className="w-full rounded border px-2 py-1.5 text-left text-[11px] transition-colors hover:opacity-85"
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              borderColor:
                                l.status === 'Scheduled'
                                  ? 'var(--accent)'
                                  : isCancelled
                                    ? 'var(--crimson)'
                                    : 'var(--border-strong)',
                              opacity: isCancelled ? 0.72 : 1,
                            }}
                          >
                            <div className="font-mono-ledger font-semibold" style={{ color: 'var(--accent)' }}>
                              {l.startTime} · {l.status === 'Scheduled' ? l.plannedDurationMin : l.actualDurationMin}m
                            </div>
                            <div className="truncate font-semibold">{s?.name ?? 'Student'}</div>
                            <div className="truncate" style={{ color: 'var(--ink-muted)' }}>
                              {l.topic || l.status}
                            </div>
                          </button>
                        )
                      })}

                      {dayTasks.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setDrawer({ kind: 'task', taskId: t.id })}
                          className="w-full rounded border px-2 py-1 text-left text-[11px]"
                          style={{
                            backgroundColor: 'var(--ochre-tint)',
                            borderColor: 'var(--border)',
                            color: 'var(--ink-primary)',
                          }}
                        >
                          <div className="truncate font-medium">Task: {t.title}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* Monthly Grid */
            <div>
              <div
                className="grid grid-cols-7 border-b text-center text-[11px] font-semibold"
                style={{ borderColor: 'var(--border)', color: 'var(--ink-muted)' }}
              >
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                  <div key={d} className="py-2">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthGrid.map((iso) => {
                  const inMonth = iso.slice(0, 7) === anchorDate.slice(0, 7)
                  const isToday = iso === today
                  const dayLessons = lessonsByDate.get(iso) ?? []
                  const dayTasks = tasksByDate.get(iso) ?? []
                  return (
                    <div
                      key={iso}
                      className="min-h-24 border-b border-r p-1.5"
                      style={{
                        borderColor: 'var(--border)',
                        backgroundColor: isToday
                          ? 'var(--accent-tint)'
                          : inMonth
                            ? 'transparent'
                            : 'var(--bg-rail)',
                        opacity: inMonth ? 1 : 0.65,
                      }}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span
                          className="tabular-nums text-[11px] font-semibold"
                          style={{ color: isToday ? 'var(--accent)' : 'var(--ink-secondary)' }}
                        >
                          {Number.parseInt(iso.slice(8), 10)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setDrawer({ kind: 'lesson', initialDate: iso })}
                          aria-label={`Add lesson on ${iso}`}
                          className="rounded p-0.5 hover:bg-black/5"
                          style={{ color: 'var(--ink-muted)' }}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        {dayLessons.slice(0, 3).map((l) => {
                          const s = studentMap.get(l.studentId)
                          return (
                            <button
                              key={l.id}
                              type="button"
                              onClick={() => setDrawer({ kind: 'lesson', lessonId: l.id })}
                              className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium"
                              style={{
                                backgroundColor:
                                  l.status === 'Scheduled'
                                    ? 'var(--accent)'
                                    : 'var(--bg-subtle)',
                                color:
                                  l.status === 'Scheduled'
                                    ? 'var(--accent-ink)'
                                    : 'var(--ink-primary)',
                              }}
                            >
                              {l.startTime} {s?.name.split(' ')[0]}
                            </button>
                          )
                        })}
                        {dayTasks.slice(0, 2).map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setDrawer({ kind: 'task', taskId: t.id })}
                            className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px]"
                            style={{ backgroundColor: 'var(--ochre-tint)', color: 'var(--ochre)' }}
                          >
                            • {t.title}
                          </button>
                        ))}
                        {dayLessons.length + dayTasks.length > 5 && (
                          <div className="tabular-nums text-[10px]" style={{ color: 'var(--ink-muted)' }}>
                            +{dayLessons.length + dayTasks.length - 5} more
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Session Log Table */
        <div className="space-y-3">
          <div className="ledger-sheet flex flex-wrap items-center gap-2 p-3 text-[12px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search topic or student…"
              className="ledger-control min-w-48 flex-1 px-2.5 py-1.5 text-[12px]"
            />
            <select
              value={studentFilter}
              onChange={(e) => setStudentFilter(e.target.value)}
              className="ledger-control px-2.5 py-1.5 text-[12px]"
            >
              <option value="all">All Students</option>
              {state.students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as LessonStatus | 'all')}
              className="ledger-control px-2.5 py-1.5 text-[12px]"
            >
              <option value="all">All Statuses</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled — Excused">Cancelled — Excused</option>
              <option value="Cancelled — Billable/No-Show">Cancelled — Billable/No-Show</option>
            </select>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as PaymentStatus | 'all')}
              className="ledger-control px-2.5 py-1.5 text-[12px]"
            >
              <option value="all">All Payment States</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Invoiced">Invoiced</option>
              <option value="Paid">Paid</option>
              <option value="Covered by Retainer/Package">Covered</option>
            </select>
          </div>

          <div className="ledger-sheet overflow-x-auto">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr
                  className="border-b text-[11px] font-semibold uppercase tracking-wide"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-rail)', color: 'var(--ink-muted)' }}
                >
                  <th className="px-4 py-2.5">Date &amp; Time</th>
                  <th className="px-4 py-2.5">Student</th>
                  <th className="px-4 py-2.5">Topic &amp; Status</th>
                  <th className="px-4 py-2.5 text-right">Duration</th>
                  <th className="px-4 py-2.5 text-right">Fee</th>
                  <th className="px-4 py-2.5">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {filteredLessons.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[13px]" style={{ color: 'var(--ink-muted)' }}>
                      No sessions match these filters.
                    </td>
                  </tr>
                ) : (
                  filteredLessons.map((l) => {
                    const s = studentMap.get(l.studentId)
                    const charge = computeLessonCharge(
                      s,
                      l,
                      s ? retainerLedgers.get(s.id) : undefined,
                      s ? packageLedgers.get(s.id) : undefined,
                    )
                    return (
                      <tr
                        key={l.id}
                        className="cursor-pointer transition-colors hover:bg-black/2"
                        style={{ borderColor: 'var(--border)' }}
                        onClick={() => setDrawer({ kind: 'lesson', lessonId: l.id })}
                      >
                        <td className="tabular-nums px-4 py-3 whitespace-nowrap">
                          <div className="font-medium">{l.date}</div>
                          <div className="font-mono-ledger text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                            {l.startTime} · {l.deliveryMode}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{s?.name ?? 'Unknown'}</div>
                          <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                            {s?.subject}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{l.topic || 'Untitled lesson'}</div>
                          <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                            {l.status}
                          </div>
                        </td>
                        <td className="tabular-nums px-4 py-3 text-right whitespace-nowrap">
                          {formatDuration(
                            l.status === 'Scheduled' ? l.plannedDurationMin : l.actualDurationMin,
                          )}
                        </td>
                        <td className="tabular-nums px-4 py-3 text-right font-semibold whitespace-nowrap">
                          {formatMoney(charge.effectivePriceMinor, cur)}
                        </td>
                        <td
                          className="px-4 py-3 whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-2">
                            <PaymentBadge status={l.paymentStatus} />
                            {(l.paymentStatus === 'Unpaid' || l.paymentStatus === 'Invoiced') &&
                              charge.effectivePriceMinor > 0 && (
                                <button
                                  type="button"
                                  onClick={() => markLessonPaid(l.id)}
                                  className="btn-secondary inline-flex items-center gap-1 px-2 py-0.5 text-[11px]"
                                >
                                  <Check className="h-3 w-3" />
                                  <span>Paid</span>
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
