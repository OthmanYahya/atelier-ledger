import { useMemo, useState } from 'react'
import { Check, Download, Plus, Repeat, Trash2 } from 'lucide-react'
import {
  BillingModelComparisonBars,
  MonthlyComparisonChart,
} from '../components/FinancialCharts'
import { useLedger } from '../context/LedgerContext'
import { computeFinancialReport, getPendingRecurringExpenses } from '../domain/analytics'
import { resolvePeriodRange } from '../domain/dates'
import { formatMoney } from '../domain/money'
import { downloadTextFile, exportExpensesCSV } from '../domain/storage'
import type { ExpenseCategory, PeriodPreset } from '../domain/types'

const PERIOD_LABELS: Array<[PeriodPreset, string]> = [
  ['this_week', 'This Week'],
  ['this_month', 'This Month'],
  ['last_month', 'Last Month'],
  ['last_90_days', 'Last 90 Days'],
  ['all_time', 'All Time'],
  ['custom', 'Custom Range'],
]

const EXPENSE_CATEGORIES: Array<ExpenseCategory | 'all'> = [
  'all',
  'Transport/Fuel',
  'Teaching Materials & Printing',
  'Software & Tools',
  'Equipment',
  'Utilities/Internet',
  'Other',
]

export function FinancesView() {
  const {
    state,
    today,
    setDrawer,
    settleReceivable,
    deleteExpense,
    materializeRecurringExpenses,
  } = useLedger()

  const [preset, setPreset] = useState<PeriodPreset>('this_month')
  const [customStart, setCustomStart] = useState(today.slice(0, 7) + '-01')
  const [customEnd, setCustomEnd] = useState(today)
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | 'all'>('all')

  const cur = state.settings.currency
  const studentMap = useMemo(() => new Map(state.students.map((s) => [s.id, s])), [state.students])
  const range = useMemo(
    () => resolvePeriodRange(preset, today, customStart, customEnd),
    [preset, today, customStart, customEnd],
  )
  const report = useMemo(
    () => computeFinancialReport(state, range, today),
    [state, range, today],
  )

  const pendingRecurring = useMemo(
    () => getPendingRecurringExpenses(state.expenses, today.slice(0, 7)),
    [state.expenses, today],
  )

  const filteredExpenses = useMemo(
    () =>
      state.expenses
        .filter(
          (e) =>
            (categoryFilter === 'all' || e.category === categoryFilter) &&
            e.date >= range.start &&
            e.date <= range.end,
        )
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date)),
    [state.expenses, categoryFilter, range],
  )

  const handleExportExpenses = () => {
    const csv = exportExpensesCSV(state.expenses, state.students, state.settings)
    downloadTextFile(`atelier-expenses-${today}.csv`, csv, 'text/csv;charset=utf-8')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Finances &amp; Expenses
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--ink-secondary)' }}>
            True earned income, collected cash, receivables aging, and net effective hourly rate.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportExpenses}
            className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px]"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Expenses CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setDrawer({ kind: 'expense' })}
            className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Log Expense</span>
          </button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex flex-wrap items-center gap-2">
        {PERIOD_LABELS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPreset(id)}
            className="rounded-md border px-3 py-1.5 text-[12px] font-medium"
            style={{
              backgroundColor: preset === id ? 'var(--accent)' : 'var(--bg-surface)',
              color: preset === id ? 'var(--accent-ink)' : 'var(--ink-secondary)',
              borderColor: preset === id ? 'var(--accent)' : 'var(--border)',
            }}
          >
            {label}
          </button>
        ))}

        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="ledger-control tabular-nums px-2 py-1 text-[12px]"
            />
            <span className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
              to
            </span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="ledger-control tabular-nums px-2 py-1 text-[12px]"
            />
          </div>
        )}
      </div>

      {/* Core Financial Ledger Strip */}
      <section
        aria-label="Financial summary metrics"
        className="ledger-sheet grid grid-cols-2 gap-px overflow-hidden sm:grid-cols-3 lg:grid-cols-6"
        style={{ backgroundColor: 'var(--border)' }}
      >
        {[
          { label: 'Gross Earned', value: formatMoney(report.grossEarnedMinor, cur), accent: 'var(--ink-primary)' },
          { label: 'Collected Cash', value: formatMoney(report.collectedCashMinor, cur), accent: 'var(--sage)' },
          {
            label: 'Unpaid Receivables',
            value: formatMoney(report.unpaidReceivablesMinor, cur),
            accent: report.unpaidReceivablesMinor > 0 ? 'var(--terracotta)' : 'var(--ink-muted)',
          },
          { label: 'Expenses', value: formatMoney(report.totalExpensesMinor, cur), accent: 'var(--crimson)' },
          {
            label: 'Net Profit',
            value: formatMoney(report.netProfitMinor, cur),
            accent: report.netProfitMinor >= 0 ? 'var(--accent)' : 'var(--crimson)',
          },
          {
            label: `Effective Rate (${report.totalHoursTaught.toFixed(1)}h)`,
            value: `${formatMoney(report.effectiveHourlyRateMinor, cur)}/hr`,
            accent: 'var(--ink-primary)',
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="p-4"
            style={{ backgroundColor: 'var(--bg-surface)' }}
          >
            <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
              {metric.label}
            </div>
            <div className="tabular-nums mt-1 text-lg font-semibold" style={{ color: metric.accent }}>
              {metric.value}
            </div>
          </div>
        ))}
      </section>

      {/* Custom SVG Visualizations */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="ledger-sheet p-5 xl:col-span-7">
          <h2 className="font-display mb-3 text-xl font-semibold">
            Monthly Revenue, Expenses &amp; Net Profit
          </h2>
          <MonthlyComparisonChart series={report.monthlySeries} currency={cur} />
        </section>

        <section className="ledger-sheet p-5 xl:col-span-5">
          <h2 className="font-display mb-3 text-xl font-semibold">
            Breakdown by Billing Model
          </h2>
          <BillingModelComparisonBars rows={report.byBillingModel} currency={cur} />
        </section>
      </div>

      {/* Student Profitability & Open Receivables */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="ledger-sheet overflow-hidden xl:col-span-7">
          <div className="border-b px-5 py-3.5" style={{ borderColor: 'var(--border)' }}>
            <h2 className="font-display text-xl font-semibold">
              Effective Hourly Rate by Student / Gig
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr
                  className="border-b text-[11px] font-semibold uppercase tracking-wide"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-rail)', color: 'var(--ink-muted)' }}
                >
                  <th className="px-4 py-2">Student</th>
                  <th className="px-4 py-2 text-right">Hours</th>
                  <th className="px-4 py-2 text-right">Earned</th>
                  <th className="px-4 py-2 text-right">Expenses</th>
                  <th className="px-4 py-2 text-right">Net Profit</th>
                  <th className="px-4 py-2 text-right">Net/hr</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {report.byStudent.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                      No student revenue recorded in this period.
                    </td>
                  </tr>
                ) : (
                  report.byStudent.map((row) => (
                    <tr key={row.studentId} style={{ borderColor: 'var(--border)' }}>
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => setDrawer({ kind: 'student', studentId: row.studentId })}
                          className="text-left font-medium hover:underline"
                        >
                          {row.name}
                        </button>
                        <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                          {row.subject} · {row.billingType}
                        </div>
                      </td>
                      <td className="tabular-nums px-4 py-2.5 text-right">{row.hoursTaught.toFixed(1)}h</td>
                      <td className="tabular-nums px-4 py-2.5 text-right">
                        {formatMoney(row.grossEarnedMinor, cur)}
                      </td>
                      <td className="tabular-nums px-4 py-2.5 text-right" style={{ color: 'var(--ink-secondary)' }}>
                        {formatMoney(row.attributedExpensesMinor, cur)}
                      </td>
                      <td className="tabular-nums px-4 py-2.5 text-right font-semibold" style={{ color: 'var(--accent)' }}>
                        {formatMoney(row.netProfitMinor, cur)}
                      </td>
                      <td className="tabular-nums px-4 py-2.5 text-right font-semibold">
                        {formatMoney(row.effectiveHourlyRateMinor, cur)}/hr
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="ledger-sheet overflow-hidden xl:col-span-5">
          <div className="border-b px-5 py-3.5" style={{ borderColor: 'var(--border)' }}>
            <h2 className="font-display text-xl font-semibold">
              Unpaid Receivables ({report.receivables.length})
            </h2>
          </div>
          {report.receivables.length === 0 ? (
            <div className="p-6 text-center text-[13px]" style={{ color: 'var(--ink-muted)' }}>
              All billable sessions, retainers, and packages are settled.
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {report.receivables.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="min-w-0">
                    <div className="font-medium">{item.studentName}</div>
                    <div className="truncate text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                      {item.title} · {item.paymentStatus}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <div className="text-right">
                      <div className="tabular-nums font-semibold" style={{ color: 'var(--terracotta)' }}>
                        {formatMoney(item.amountMinor, cur)}
                      </div>
                      <div className="tabular-nums text-[10px]" style={{ color: 'var(--ink-muted)' }}>
                        {item.daysOverdue}d overdue
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => settleReceivable(item)}
                      className="btn-secondary inline-flex items-center gap-1 px-2.5 py-1 text-[11px]"
                    >
                      <Check className="h-3 w-3" />
                      <span>Mark Paid</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Pending Recurring Monthly Expenses Alert */}
      {pendingRecurring.length > 0 && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-[13px]"
          style={{ backgroundColor: 'var(--ochre-tint)', borderColor: 'var(--ochre)' }}
        >
          <span>
            <strong>{pendingRecurring.length}</strong> recurring monthly expense(s) from prior months not yet logged for{' '}
            <span className="tabular-nums">{today.slice(0, 7)}</span>.
          </span>
          <button
            type="button"
            onClick={() => materializeRecurringExpenses(pendingRecurring)}
            className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1 text-[12px]"
          >
            <Repeat className="h-3.5 w-3.5" />
            <span>Log All for This Month</span>
          </button>
        </div>
      )}

      {/* Expense Ledger */}
      <section className="ledger-sheet overflow-hidden">
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2 className="font-display text-xl font-semibold">Expense Ledger</h2>
          <select
            aria-label="Filter expense category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as ExpenseCategory | 'all')}
            className="ledger-control px-2.5 py-1.5 text-[12px]"
          >
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr
                className="border-b text-[11px] font-semibold uppercase tracking-wide"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-rail)', color: 'var(--ink-muted)' }}
              >
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Expense</th>
                <th className="px-4 py-2.5">Category</th>
                <th className="px-4 py-2.5">Attributed Gig</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
                <th className="px-4 py-2.5 text-right">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[13px]" style={{ color: 'var(--ink-muted)' }}>
                    No expenses logged in this period.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((e) => (
                  <tr
                    key={e.id}
                    className="cursor-pointer transition-colors hover:bg-black/2"
                    style={{ borderColor: 'var(--border)' }}
                    onClick={() => setDrawer({ kind: 'expense', expenseId: e.id })}
                  >
                    <td className="tabular-nums px-4 py-2.5 whitespace-nowrap">{e.date}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2 font-medium">
                        <span>{e.title}</span>
                        {e.isRecurringMonthly && (
                          <span
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]"
                            style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--ink-secondary)' }}
                          >
                            <Repeat className="h-2.5 w-2.5" />
                            Monthly
                          </span>
                        )}
                      </div>
                      {e.notes && (
                        <div className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                          {e.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[12px]" style={{ color: 'var(--ink-secondary)' }}>
                      {e.category}
                    </td>
                    <td className="px-4 py-2.5 text-[12px]" style={{ color: 'var(--ink-secondary)' }}>
                      {e.studentId ? studentMap.get(e.studentId)?.name ?? '—' : 'General Studio'}
                    </td>
                    <td className="tabular-nums px-4 py-2.5 text-right font-semibold" style={{ color: 'var(--crimson)' }}>
                      {formatMoney(e.amountMinor, cur)}
                    </td>
                    <td
                      className="px-4 py-2.5 text-right"
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => deleteExpense(e.id)}
                        aria-label={`Delete ${e.title}`}
                        className="rounded p-1 hover:bg-black/5"
                        style={{ color: 'var(--ink-muted)' }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
