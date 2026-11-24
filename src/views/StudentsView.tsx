import { useMemo, useState } from 'react'
import { AlertTriangle, FileText, Plus, Search, UserPlus } from 'lucide-react'
import { useLedger } from '../context/LedgerContext'
import {
  computeLessonCharge,
  computePackageLedger,
  computeRetainerLedger,
  formatPackageCredits,
  isLessonBillable,
} from '../domain/billing'
import { formatMoney } from '../domain/money'
import type { BillingModel, StudentStatus } from '../domain/types'

export function StudentsView() {
  const { state, today, setDrawer } = useLedger()
  const [statusFilter, setStatusFilter] = useState<StudentStatus | 'all'>('Active')
  const [modelFilter, setModelFilter] = useState<BillingModel['type'] | 'all'>('all')
  const [search, setSearch] = useState('')
  const cur = state.settings.currency

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return state.students
      .filter((s) => {
        if (statusFilter !== 'all' && s.status !== statusFilter) return false
        if (modelFilter !== 'all' && s.billingModel.type !== modelFilter) return false
        if (q && !`${s.name} ${s.subject} ${s.contact}`.toLowerCase().includes(q)) return false
        return true
      })
      .map((student) => {
        const retLedger =
          student.billingModel.type === 'retainer'
            ? computeRetainerLedger(student, state.lessons, state.retainerPayments, today)
            : undefined
        const pkgLedger =
          student.billingModel.type === 'package'
            ? computePackageLedger(student, state.lessons)
            : undefined

        const studentLessons = state.lessons.filter((l) => l.studentId === student.id)
        let unpaidMinor = 0
        for (const l of studentLessons) {
          if (
            isLessonBillable(l.status) &&
            (l.paymentStatus === 'Unpaid' || l.paymentStatus === 'Invoiced')
          ) {
            unpaidMinor += computeLessonCharge(student, l, retLedger, pkgLedger).effectivePriceMinor
          }
        }
        if (retLedger) {
          for (const c of retLedger.cycles) {
            if (c.paymentStatus === 'Unpaid' || c.paymentStatus === 'Invoiced') {
              unpaidMinor += c.monthlyFeeMinor
            }
          }
        }
        if (student.billingModel.type === 'package') {
          for (const p of student.billingModel.purchases) {
            if (p.paymentStatus === 'Unpaid' || p.paymentStatus === 'Invoiced') {
              unpaidMinor += p.priceMinor
            }
          }
        }

        const openTasksCount = state.tasks.filter(
          (t) => t.studentId === student.id && t.status !== 'Done',
        ).length

        return { student, retLedger, pkgLedger, unpaidMinor, openTasksCount, lessonCount: studentLessons.length }
      })
  }, [state.students, state.lessons, state.retainerPayments, state.tasks, statusFilter, modelFilter, search, today])

  const billingSummary = (row: (typeof rows)[number]): string => {
    const m = row.student.billingModel
    switch (m.type) {
      case 'hourly':
        return `${formatMoney(m.ratePerHourMinor, cur)}/hr${m.billPrepTime ? ' + prep' : ''}`
      case 'flat':
        return `${formatMoney(m.ratePerSessionMinor, cur)}/session (flat)`
      case 'retainer': {
        const latest = row.retLedger?.cycles[row.retLedger.cycles.length - 1]
        const eff =
          latest && latest.completedMinutes > 0
            ? ` · Eff. ${formatMoney(latest.effectiveHourlyRateMinor, cur)}/hr`
            : ''
        return `${formatMoney(m.monthlyFeeMinor, cur)}/mo${eff}`
      }
      case 'package':
        return row.pkgLedger
          ? `${formatPackageCredits(row.pkgLedger.remainingUnits, row.pkgLedger.unit)} left`
          : 'Prepaid Package'
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Students &amp; Gigs</h1>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--ink-secondary)' }}>
            Manage hourly, flat-session, monthly retainer, and prepaid package engagements.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDrawer({ kind: 'student' })}
          className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px]"
        >
          <UserPlus className="h-3.5 w-3.5" />
          <span>Add Student / Gig</span>
        </button>
      </div>

      {/* Filters */}
      <div className="ledger-sheet flex flex-wrap items-center gap-2 p-3 text-[12px]">
        <div className="relative min-w-48 flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5"
            style={{ color: 'var(--ink-muted)' }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student or subject…"
            className="ledger-control w-full py-1.5 pr-3 pl-8 text-[12px]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StudentStatus | 'all')}
          className="ledger-control px-2.5 py-1.5 text-[12px]"
        >
          <option value="Active">Active</option>
          <option value="Paused">Paused</option>
          <option value="Archived">Archived</option>
          <option value="all">All Statuses</option>
        </select>
        <select
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value as BillingModel['type'] | 'all')}
          className="ledger-control px-2.5 py-1.5 text-[12px]"
        >
          <option value="all">All Billing Models</option>
          <option value="hourly">Hourly</option>
          <option value="flat">Flat Per-Session</option>
          <option value="retainer">Monthly Retainer</option>
          <option value="package">Prepaid Package</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="ledger-sheet p-10 text-center">
          <p className="text-[14px]" style={{ color: 'var(--ink-secondary)' }}>
            No students match these filters yet.
          </p>
          <button
            type="button"
            onClick={() => setDrawer({ kind: 'student' })}
            className="btn-primary mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add First Student</span>
          </button>
        </div>
      ) : (
        <div className="ledger-sheet overflow-x-auto">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr
                className="border-b text-[11px] font-semibold uppercase tracking-wide"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-rail)', color: 'var(--ink-muted)' }}
              >
                <th className="px-4 py-2.5">Student &amp; Subject</th>
                <th className="px-4 py-2.5">Mode</th>
                <th className="px-4 py-2.5">Billing Plan &amp; Balance</th>
                <th className="px-4 py-2.5 text-right">Unpaid</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {rows.map((row) => {
                const { student, pkgLedger, unpaidMinor, openTasksCount, lessonCount } = row
                return (
                  <tr
                    key={student.id}
                    className="transition-colors hover:bg-black/2"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setDrawer({ kind: 'student', studentId: student.id })}
                        className="text-left hover:underline"
                      >
                        <div className="font-semibold">{student.name}</div>
                        <div className="text-[12px]" style={{ color: 'var(--ink-secondary)' }}>
                          {student.subject}
                          {openTasksCount > 0 && (
                            <span className="tabular-nums ml-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                              · {openTasksCount} prep tasks
                            </span>
                          )}
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-[12px]" style={{ color: 'var(--ink-secondary)' }}>
                      <div>{student.deliveryMode}</div>
                      <div className="tabular-nums text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                        {lessonCount} sessions
                      </div>
                    </td>
                    <td className="tabular-nums px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{billingSummary(row)}</span>
                        {pkgLedger?.isLowCredit && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                            style={{ backgroundColor: 'var(--terracotta-tint)', color: 'var(--terracotta)' }}
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Low credit
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="tabular-nums px-4 py-3 text-right font-semibold">
                      <span style={{ color: unpaidMinor > 0 ? 'var(--terracotta)' : 'var(--ink-muted)' }}>
                        {formatMoney(unpaidMinor, cur)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDrawer({ kind: 'lesson', initialStudentId: student.id })}
                          className="btn-secondary px-2.5 py-1 text-[11px]"
                        >
                          + Lesson
                        </button>
                        <button
                          type="button"
                          onClick={() => setDrawer({ kind: 'statement', studentId: student.id })}
                          className="btn-secondary inline-flex items-center gap-1 px-2.5 py-1 text-[11px]"
                          title="Print-ready statement"
                        >
                          <FileText className="h-3 w-3" />
                          <span>Statement</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
