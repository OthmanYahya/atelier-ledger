import {
  AlertTriangle,
  ArrowRight,
  CalendarPlus,
  Check,
  Clock,
  Eraser,
  Play,
  Plus,
  Receipt,
} from 'lucide-react'
import { useMemo } from 'react'
import { PaymentBadge, PriorityBadge } from '../components/Badges'
import { useLedger } from '../context/LedgerContext'
import { computeFinancialReport } from '../domain/analytics'
import {
  buildStudentBillingLedgers,
  computeLessonCharge,
  computePackageLedger,
  formatPackageCredits,
} from '../domain/billing'
import { addDaysISO, formatDuration, formatShortDate, resolvePeriodRange } from '../domain/dates'
import { formatMoney } from '../domain/money'

export function OverviewView() {
  const {
    state,
    today,
    setActiveNav,
    setDrawer,
    toggleTaskDone,
    settleReceivable,
    startTimer,
    clearDemoData,
  } = useLedger()

  const cur = state.settings.currency
  const studentMap = useMemo(() => new Map(state.students.map((s) => [s.id, s])), [state.students])

  const monthReport = useMemo(
    () => computeFinancialReport(state, resolvePeriodRange('this_month', today), today),
    [state, today],
  )

  const todayLessons = useMemo(
    () =>
      state.lessons
        .filter((l) => l.date === today)
        .slice()
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [state.lessons, today],
  )

  const upcomingLessons = useMemo(() => {
    const horizon = addDaysISO(today, 7)
    return state.lessons
      .filter((l) => l.date > today && l.date <= horizon && l.status === 'Scheduled')
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
      .slice(0, 5)
  }, [state.lessons, today])

  const focusTasks = useMemo(
    () =>
      state.tasks
        .filter((t) => t.status !== 'Done' && (!t.dueDate || t.dueDate <= today))
        .slice()
        .sort((a, b) => {
          const rank = { Urgent: 0, High: 1, Medium: 2, Low: 3 }
          return (
            (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
            rank[a.priority] - rank[b.priority]
          )
        }),
    [state.tasks, today],
  )

  const lowCreditStudents = useMemo(
    () =>
      state.students
        .filter((s) => s.status === 'Active' && s.billingModel.type === 'package')
        .map((s) => ({
          student: s,
          ledger: computePackageLedger(s, state.lessons),
        }))
        .filter((x) => x.ledger.isLowCredit),
    [state.students, state.lessons],
  )

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Atelier Overview</h1>
          <p className="tabular-nums mt-1 text-[13px]" style={{ color: 'var(--ink-secondary)' }}>
            {new Intl.DateTimeFormat('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            }).format(new Date(`${today}T12:00:00`))}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDrawer({ kind: 'task' })}
            className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Task</span>
            <kbd className="font-mono-ledger text-[10px] opacity-70">N</kbd>
          </button>
          <button
            type="button"
            onClick={() => setDrawer({ kind: 'lesson', initialDate: today })}
            className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px]"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            <span>Log Lesson</span>
            <kbd className="font-mono-ledger text-[10px] opacity-80">L</kbd>
          </button>
          <button
            type="button"
            onClick={() => setDrawer({ kind: 'expense' })}
            className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px]"
          >
            <Receipt className="h-3.5 w-3.5" />
            <span>Expense</span>
          </button>
        </div>
      </div>

      {/* Prominent Demo Data Bar */}
      {state.demoLoaded && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-[13px]"
          style={{
            backgroundColor: 'var(--bg-rail)',
            borderColor: 'var(--border-strong)',
          }}
        >
          <span style={{ color: 'var(--ink-secondary)' }}>
            Sample studio data is active (4 students, 2 weeks of lessons, linked prep tasks, and expenses).
          </span>
          <button
            type="button"
            onClick={clearDemoData}
            className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1 text-[12px] font-medium"
          >
            <Eraser className="h-3.5 w-3.5" />
            <span>Clear Demo Data / Start Fresh</span>
          </button>
        </div>
      )}

      {/* Quiet Monthly Pulse Strip (single sheet with crisp 1px hairline grid) */}
      <section
        aria-label="This month studio pulse"
        className="ledger-sheet grid grid-cols-2 gap-px overflow-hidden sm:grid-cols-4"
        style={{ backgroundColor: 'var(--border)' }}
      >
        <button
          type="button"
          onClick={() => setActiveNav('finances')}
          className="p-4 text-left transition-colors hover:opacity-90"
          style={{ backgroundColor: 'var(--bg-surface)' }}
        >
          <div className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
            Net Profit (This Month{state.demoLoaded ? ' · Sample' : ''})
          </div>
          <div className="tabular-nums mt-1 text-xl font-semibold" style={{ color: 'var(--accent)' }}>
            {formatMoney(monthReport.netProfitMinor, cur)}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveNav('finances')}
          className="p-4 text-left transition-colors hover:opacity-90"
          style={{ backgroundColor: 'var(--bg-surface)' }}
        >
          <div className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
            Unpaid Receivables
          </div>
          <div
            className="tabular-nums mt-1 text-xl font-semibold"
            style={{
              color:
                monthReport.unpaidReceivablesMinor > 0
                  ? 'var(--terracotta)'
                  : 'var(--ink-primary)',
            }}
          >
            {formatMoney(monthReport.unpaidReceivablesMinor, cur)}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveNav('lessons')}
          className="p-4 text-left transition-colors hover:opacity-90"
          style={{ backgroundColor: 'var(--bg-surface)' }}
        >
          <div className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
            Hours Taught
          </div>
          <div className="tabular-nums mt-1 text-xl font-semibold">
            {monthReport.totalHoursTaught.toFixed(1)}h
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveNav('finances')}
          className="p-4 text-left transition-colors hover:opacity-90"
          style={{ backgroundColor: 'var(--bg-surface)' }}
        >
          <div className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
            True Effective Rate
          </div>
          <div className="tabular-nums mt-1 text-xl font-semibold">
            {formatMoney(monthReport.effectiveHourlyRateMinor, cur)}/hr
          </div>
        </button>
      </section>

      {/* Main Split Operational Ledger */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left: Today's Sessions & 7-Day Agenda */}
        <section className="ledger-sheet p-5 xl:col-span-7">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display text-xl font-semibold">Today&apos;s Tutoring Schedule</h2>
            <button
              type="button"
              onClick={() => setActiveNav('lessons')}
              className="inline-flex items-center gap-1 text-[12px] font-medium hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              <span>Calendar &amp; Log</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {todayLessons.length === 0 ? (
            <div
              className="rounded-lg border border-dashed p-5 text-center"
              style={{ borderColor: 'var(--border-strong)' }}
            >
              <p className="text-[13px]" style={{ color: 'var(--ink-secondary)' }}>
                No sessions scheduled for today.
              </p>
              <button
                type="button"
                onClick={() => setDrawer({ kind: 'lesson', initialDate: today })}
                className="btn-secondary mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Schedule Today&apos;s Lesson</span>
              </button>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {todayLessons.map((lesson) => {
                const student = studentMap.get(lesson.studentId)
                const charge = computeLessonCharge(
                  student,
                  lesson,
                  retainerLedgers.get(lesson.studentId),
                  packageLedgers.get(lesson.studentId),
                )
                return (
                  <div
                    key={lesson.id}
                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <button
                      type="button"
                      onClick={() => setDrawer({ kind: 'lesson', lessonId: lesson.id })}
                      className="min-w-0 flex-1 text-left hover:opacity-80"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono-ledger text-[12px] font-semibold" style={{ color: 'var(--accent)' }}>
                          {lesson.startTime}
                        </span>
                        <span className="font-semibold">{student?.name ?? 'Unknown Student'}</span>
                        <span className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                          {student?.subject} · {lesson.deliveryMode}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-[13px]" style={{ color: 'var(--ink-secondary)' }}>
                        {lesson.topic || 'Untitled lesson'}
                      </div>
                    </button>

                    <div className="flex items-center gap-2.5">
                      <span className="tabular-nums text-[12px]" style={{ color: 'var(--ink-secondary)' }}>
                        {formatDuration(
                          lesson.status === 'Scheduled'
                            ? lesson.plannedDurationMin
                            : lesson.actualDurationMin,
                        )}
                      </span>
                      <span className="tabular-nums text-[13px] font-semibold">
                        {formatMoney(charge.effectivePriceMinor, cur)}
                      </span>
                      <PaymentBadge status={lesson.paymentStatus} />
                      {lesson.status === 'Scheduled' && (
                        <button
                          type="button"
                          onClick={() =>
                            startTimer(lesson.studentId, lesson.id, lesson.topic)
                          }
                          className="btn-secondary inline-flex items-center gap-1 px-2 py-1 text-[11px]"
                          title="Start live session timer"
                        >
                          <Play className="h-3 w-3" />
                          <span>Timer</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Upcoming next 7 days */}
          <div className="mt-6 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            <h3 className="mb-2 text-[13px] font-semibold" style={{ color: 'var(--ink-secondary)' }}>
              Upcoming Sessions (Next 7 Days)
            </h3>
            {upcomingLessons.length === 0 ? (
              <p className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                Clear horizon for the next 7 days.
              </p>
            ) : (
              <div className="space-y-1.5">
                {upcomingLessons.map((l) => {
                  const s = studentMap.get(l.studentId)
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setDrawer({ kind: 'lesson', lessonId: l.id })}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-black/5"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--ink-muted)' }} />
                        <span className="tabular-nums font-medium">{formatShortDate(l.date)}</span>
                        <span className="font-mono-ledger text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                          {l.startTime}
                        </span>
                        <span className="truncate font-medium">{s?.name}</span>
                        <span className="hidden truncate text-[12px] sm:inline" style={{ color: 'var(--ink-muted)' }}>
                          — {l.topic}
                        </span>
                      </span>
                      <span className="tabular-nums shrink-0 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                        {l.plannedDurationMin}m
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {/* Right: Today & Overdue Tasks + Studio Action Alerts */}
        <div className="space-y-5 xl:col-span-5">
          <section className="ledger-sheet p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-display text-xl font-semibold">Today &amp; Overdue Tasks</h2>
              <button
                type="button"
                onClick={() => setActiveNav('tasks')}
                className="inline-flex items-center gap-1 text-[12px] font-medium hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                <span>All Tasks</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {focusTasks.length === 0 ? (
              <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
                All due prep and admin tasks are complete.
              </p>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {focusTasks.slice(0, 7).map((task) => {
                  const isOverdue = Boolean(task.dueDate && task.dueDate < today)
                  const stName = task.studentId ? studentMap.get(task.studentId)?.name : undefined
                  const doneSubs = task.subtasks.filter((x) => x.done).length
                  return (
                    <div
                      key={task.id}
                      className="flex items-start gap-2.5 py-2.5"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <input
                        type="checkbox"
                        checked={task.status === 'Done'}
                        onChange={() => toggleTaskDone(task.id)}
                        aria-label={`Mark ${task.title} complete`}
                        className="mt-1 cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => setDrawer({ kind: 'task', taskId: task.id })}
                        className="min-w-0 flex-1 text-left hover:opacity-80"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-medium">{task.title}</span>
                          <PriorityBadge priority={task.priority} />
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                          {task.dueDate && (
                            <span
                              className="tabular-nums font-medium"
                              style={{ color: isOverdue ? 'var(--crimson)' : 'var(--ink-muted)' }}
                            >
                              {isOverdue ? `Overdue (${task.dueDate})` : `Due ${task.dueDate}`}
                            </span>
                          )}
                          {stName && <span>· {stName}</span>}
                          {task.subtasks.length > 0 && (
                            <span className="tabular-nums">
                              · {doneSubs}/{task.subtasks.length} steps
                            </span>
                          )}
                        </div>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Receivables & Low Package Credits */}
          {(monthReport.receivables.length > 0 || lowCreditStudents.length > 0) && (
            <section className="ledger-sheet p-5">
              <h2 className="font-display mb-3 text-xl font-semibold">Attention Required</h2>

              {lowCreditStudents.length > 0 && (
                <div className="mb-4 space-y-2">
                  {lowCreditStudents.map(({ student, ledger }) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-[12px]"
                      style={{
                        backgroundColor: 'var(--terracotta-tint)',
                        borderColor: 'var(--terracotta)',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: 'var(--terracotta)' }} />
                        <span>
                          <strong>{student.name}</strong> has{' '}
                          <span className="tabular-nums font-semibold">
                            {formatPackageCredits(ledger.remainingUnits, ledger.unit)}
                          </span>{' '}
                          remaining
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDrawer({ kind: 'student', studentId: student.id })}
                        className="font-semibold underline"
                        style={{ color: 'var(--terracotta)' }}
                      >
                        Renew
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {monthReport.receivables.length > 0 && (
                <div className="space-y-2">
                  {monthReport.receivables.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-[12px]"
                      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-rail)' }}
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{item.studentName}</div>
                        <div className="tabular-nums text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                          <span className="whitespace-nowrap">{formatShortDate(item.date)}</span> · {item.daysOverdue}d aging
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="tabular-nums font-semibold">
                          {formatMoney(item.amountMinor, cur)}
                        </span>
                        <button
                          type="button"
                          onClick={() => settleReceivable(item)}
                          className="btn-secondary inline-flex items-center gap-1 px-2 py-1 text-[11px]"
                        >
                          <Check className="h-3 w-3" />
                          <span>Paid</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
