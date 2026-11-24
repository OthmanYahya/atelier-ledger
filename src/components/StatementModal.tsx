import { useEffect, useMemo, useState } from 'react'
import { Printer, X } from 'lucide-react'
import { useLedger } from '../context/LedgerContext'
import {
  computeLessonCharge,
  computePackageLedger,
  computeRetainerLedger,
  isLessonBillable,
} from '../domain/billing'
import { isWithinRange, resolvePeriodRange } from '../domain/dates'
import { formatMoney } from '../domain/money'

export function StatementModal() {
  const { state, today, drawer, setDrawer } = useLedger()
  const isOpen = drawer?.kind === 'statement'
  const student = isOpen ? state.students.find((s) => s.id === drawer.studentId) : undefined

  const defaultMonth = useMemo(() => resolvePeriodRange('this_month', today), [today])
  const [startDate, setStartDate] = useState(defaultMonth.start)
  const [endDate, setEndDate] = useState(defaultMonth.end)

  const applyPreset = (preset: 'this_month' | 'last_90_days' | 'all_time') => {
    const r = resolvePeriodRange(preset, today)
    setStartDate(preset === 'all_time' ? student?.createdAt ?? r.start : r.start)
    setEndDate(preset === 'all_time' ? today : r.end)
  }

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setDrawer(student ? { kind: 'student', studentId: student.id } : null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, setDrawer, student])

  if (!isOpen || !student) return null

  const cur = state.settings.currency
  const range = startDate <= endDate ? { start: startDate, end: endDate } : { start: endDate, end: startDate }

  const retainerLedger =
    student.billingModel.type === 'retainer'
      ? computeRetainerLedger(student, state.lessons, state.retainerPayments, today)
      : undefined
  const packageLedger =
    student.billingModel.type === 'package'
      ? computePackageLedger(student, state.lessons)
      : undefined

  interface StatementLine {
    date: string
    description: string
    detail: string
    amountMinor: number
    paidMinor: number
    status: string
  }

  const lines: StatementLine[] = []

  // Retainer cycle charges
  if (retainerLedger) {
    for (const c of retainerLedger.cycles) {
      if (isWithinRange(c.startISO, range) && c.monthlyFeeMinor > 0) {
        lines.push({
          date: c.startISO,
          description: `Monthly Retainer (${c.cycleKey})`,
          detail: `${(c.billableMinutes / 60).toFixed(1)}h taught (${c.startISO} – ${c.endISO})`,
          amountMinor: c.monthlyFeeMinor,
          paidMinor: c.paymentStatus === 'Paid' ? c.monthlyFeeMinor : 0,
          status: c.paymentStatus,
        })
      }
    }
  }

  // Package purchases
  if (student.billingModel.type === 'package') {
    for (const p of student.billingModel.purchases) {
      if (isWithinRange(p.purchasedDate, range)) {
        lines.push({
          date: p.purchasedDate,
          description: p.label || 'Prepaid Bundle',
          detail: `${student.billingModel.unit === 'lessons' ? `${p.unitsGranted} lessons` : `${(p.unitsGranted / 60).toFixed(1)} hours`}`,
          amountMinor: p.priceMinor,
          paidMinor: p.paymentStatus === 'Paid' ? p.priceMinor : 0,
          status: p.paymentStatus,
        })
      }
    }
  }

  // Lessons in range
  const lessonsInRange = state.lessons
    .filter((l) => l.studentId === student.id && isLessonBillable(l.status) && isWithinRange(l.date, range))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))

  for (const lesson of lessonsInRange) {
    const charge = computeLessonCharge(student, lesson, retainerLedger, packageLedger)
    lines.push({
      date: lesson.date,
      description: lesson.topic || 'Tutoring Session',
      detail: `${lesson.startTime} · ${lesson.actualDurationMin}m · ${lesson.status}`,
      amountMinor: charge.effectivePriceMinor,
      paidMinor: lesson.paymentStatus === 'Paid' ? charge.effectivePriceMinor : 0,
      status:
        charge.isCoveredByPlan && charge.effectivePriceMinor === 0
          ? 'Included'
          : lesson.paymentStatus,
    })
  }

  lines.sort((a, b) => a.date.localeCompare(b.date))
  const totalBilled = lines.reduce((acc, l) => acc + l.amountMinor, 0)
  const totalPaid = lines.reduce((acc, l) => acc + l.paidMinor, 0)
  const balanceDue = totalBilled - totalPaid

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`Client statement for ${student.name}`}
    >
      <div
        className="print-only-sheet relative w-full max-w-3xl rounded-xl border p-6 sm:p-10"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-strong)',
          boxShadow: 'var(--shadow-overlay)',
        }}
      >
        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[12px]" style={{ color: 'var(--ink-secondary)' }}>
              Range:
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="ledger-control tabular-nums px-2 py-1 text-[12px]"
            />
            <span className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
              to
            </span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="ledger-control tabular-nums px-2 py-1 text-[12px]"
            />
            <button
              type="button"
              onClick={() => applyPreset('this_month')}
              className="btn-secondary px-2 py-1 text-[11px]"
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => applyPreset('last_90_days')}
              className="btn-secondary px-2 py-1 text-[11px]"
            >
              90d
            </button>
            <button
              type="button"
              onClick={() => applyPreset('all_time')}
              className="btn-secondary px-2 py-1 text-[11px]"
            >
              All
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px]"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / PDF</span>
            </button>
            <button
              type="button"
              onClick={() => setDrawer({ kind: 'student', studentId: student.id })}
              aria-label="Close statement"
              className="btn-secondary p-1.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Invoice / Statement Body */}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h1 className="font-display text-2xl font-semibold">Statement &amp; Tuition Summary</h1>
            <p className="mt-1 text-[13px]" style={{ color: 'var(--ink-secondary)' }}>
              Atelier Ledger · Issued {today}
            </p>
          </div>
          <div className="text-right">
            <div className="text-[15px] font-semibold">{student.name}</div>
            <div className="text-[13px]" style={{ color: 'var(--ink-secondary)' }}>
              {student.subject}
            </div>
            {student.contact && (
              <div className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                {student.contact}
              </div>
            )}
            <div className="tabular-nums mt-1 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
              Period: {range.start} – {range.end}
            </div>
          </div>
        </header>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b text-[11px] font-semibold uppercase tracking-wide" style={{ borderColor: 'var(--border-strong)', color: 'var(--ink-muted)' }}>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Description</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-[13px]" style={{ color: 'var(--ink-muted)' }}>
                    No billable sessions or plan charges in this date range.
                  </td>
                </tr>
              ) : (
                lines.map((line, idx) => (
                  <tr key={`${line.date}-${idx}`} style={{ borderColor: 'var(--border)' }}>
                    <td className="tabular-nums py-2.5 pr-3 align-top whitespace-nowrap">{line.date}</td>
                    <td className="py-2.5 pr-3 align-top">
                      <div className="font-medium">{line.description}</div>
                      <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                        {line.detail}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 align-top text-[12px]" style={{ color: 'var(--ink-secondary)' }}>
                      {line.status}
                    </td>
                    <td className="tabular-nums py-2.5 text-right align-top font-medium">
                      {formatMoney(line.amountMinor, cur)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="mt-6 flex justify-end border-t pt-4" style={{ borderColor: 'var(--border-strong)' }}>
          <dl className="w-64 space-y-1.5 text-[13px]">
            <div className="flex justify-between">
              <dt style={{ color: 'var(--ink-secondary)' }}>Total Billed</dt>
              <dd className="tabular-nums font-medium">{formatMoney(totalBilled, cur)}</dd>
            </div>
            <div className="flex justify-between">
              <dt style={{ color: 'var(--ink-secondary)' }}>Payments Settled</dt>
              <dd className="tabular-nums font-medium">{formatMoney(totalPaid, cur)}</dd>
            </div>
            <div className="flex justify-between border-t pt-2 text-[15px] font-semibold" style={{ borderColor: 'var(--border)' }}>
              <dt>Balance Due</dt>
              <dd className="tabular-nums" style={{ color: balanceDue > 0 ? 'var(--terracotta)' : 'var(--accent)' }}>
                {formatMoney(balanceDue, cur)}
              </dd>
            </div>
          </dl>
        </footer>
      </div>
    </div>
  )
}
