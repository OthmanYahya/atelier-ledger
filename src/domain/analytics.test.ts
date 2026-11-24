import { describe, expect, it } from 'vitest'
import { computeFinancialReport, getPendingRecurringExpenses } from './analytics'
import { createEmptyLedgerState } from './storage'

describe('financial analytics', () => {
  it('computes net profit, cash collected, receivables aging, and effective hourly rate', () => {
    const state = createEmptyLedgerState()
    state.students = [
      {
        id: 's1',
        name: 'Student A',
        subject: 'Math',
        contact: '',
        notes: '',
        deliveryMode: 'Online',
        status: 'Active',
        billingModel: { type: 'hourly', ratePerHourMinor: 10000, billPrepTime: false },
        createdAt: '2026-11-01',
      },
    ]
    state.lessons = [
      {
        id: 'l1',
        studentId: 's1',
        date: '2026-11-10',
        startTime: '10:00',
        plannedDurationMin: 60,
        actualDurationMin: 60,
        topic: 'Paid hour',
        deliveryMode: 'Online',
        status: 'Completed',
        paymentStatus: 'Paid',
        paidDate: '2026-11-11',
        homeworkAssigned: '',
        nextLessonPlan: '',
      },
      {
        id: 'l2',
        studentId: 's1',
        date: '2026-11-15',
        startTime: '10:00',
        plannedDurationMin: 60,
        actualDurationMin: 0,
        topic: 'No-show fee',
        deliveryMode: 'Online',
        status: 'Cancelled — Billable/No-Show',
        manualOverrideMinor: 5000,
        paymentStatus: 'Unpaid',
        homeworkAssigned: '',
        nextLessonPlan: '',
      },
    ]
    state.expenses = [
      {
        id: 'e1',
        date: '2026-11-12',
        title: 'Worksheets',
        category: 'Teaching Materials & Printing',
        amountMinor: 2000,
        isRecurringMonthly: false,
        paymentMethod: 'Card',
        notes: '',
        studentId: 's1',
      },
    ]

    const report = computeFinancialReport(
      state,
      { start: '2026-11-01', end: '2026-11-30' },
      '2026-11-24',
    )

    expect(report.grossEarnedMinor).toBe(15000) // $100 + $50 no-show
    expect(report.collectedCashMinor).toBe(10000)
    expect(report.unpaidReceivablesMinor).toBe(5000)
    expect(report.receivables[0].daysOverdue).toBe(9)
    expect(report.totalExpensesMinor).toBe(2000)
    expect(report.netProfitMinor).toBe(13000)
    expect(report.totalHoursTaught).toBe(1) // no-show does not inflate hours taught
    expect(report.effectiveHourlyRateMinor).toBe(13000) // $130 net / 1h taught
    expect(report.byStudent[0].netProfitMinor).toBe(13000)
  })

  it('detects pending monthly recurring expenses not yet logged this month', () => {
    const pending = getPendingRecurringExpenses(
      [
        {
          id: 'e1',
          date: '2026-10-05',
          title: 'Zoom Pro',
          category: 'Software & Tools',
          amountMinor: 1600,
          isRecurringMonthly: true,
          paymentMethod: 'Card',
          notes: '',
        },
        {
          id: 'e2',
          date: '2026-10-02',
          title: 'Transit Pass',
          category: 'Transport/Fuel',
          amountMinor: 4000,
          isRecurringMonthly: true,
          paymentMethod: 'Card',
          notes: '',
        },
        {
          id: 'e3',
          date: '2026-11-02',
          title: 'Transit Pass',
          category: 'Transport/Fuel',
          amountMinor: 4000,
          isRecurringMonthly: true,
          paymentMethod: 'Card',
          notes: '',
        },
      ],
      '2026-11',
    )
    expect(pending).toHaveLength(1)
    expect(pending[0].title).toBe('Zoom Pro')
  })
})
