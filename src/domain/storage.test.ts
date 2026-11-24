import { describe, expect, it } from 'vitest'
import { computeLessonCharge, computePackageLedger } from './billing'
import {
  createDemoLedgerState,
  exportExpensesCSV,
  exportLessonsCSV,
  validateImportPayload,
} from './storage'

describe('storage schema validation & exports', () => {
  it('validates demo ledger state and rejects malformed payloads', () => {
    const demo = createDemoLedgerState('2026-11-24')
    expect(demo.students).toHaveLength(4)
    const priya = demo.students.find((s) => s.id === 'stu-priya')!
    const pkgLedger = computePackageLedger(priya, demo.lessons)
    expect(pkgLedger.remainingUnits).toBe(2)
    expect(pkgLedger.isLowCredit).toBe(true)

    const valid = validateImportPayload(JSON.stringify(demo))
    expect(valid.ok).toBe(true)

    expect(validateImportPayload('{bad json').ok).toBe(false)
    expect(validateImportPayload(JSON.stringify({ ...demo, schemaVersion: 99 })).ok).toBe(false)
    expect(
      validateImportPayload(
        JSON.stringify({
          ...demo,
          expenses: [{ ...demo.expenses[0], amountMinor: 12.5 }],
        }),
      ).ok,
    ).toBe(false)
  })

  it('escapes commas, quotes, and formula prefixes in CSV exports', () => {
    const demo = createDemoLedgerState('2026-11-24')
    demo.expenses.push({
      id: 'exp-inj',
      date: '2026-11-24',
      title: '=SUM(A1:A2)',
      category: 'Other',
      amountMinor: 500,
      isRecurringMonthly: false,
      paymentMethod: 'Cash',
      notes: 'Note with, "quotes"',
    })
    const csvExp = exportExpensesCSV(demo.expenses, demo.students, demo.settings)
    expect(csvExp).toContain("'=SUM(A1:A2)")
    expect(csvExp).toContain('"Note with, ""quotes"""')

    const csvLes = exportLessonsCSV(demo.lessons, demo.students, demo.settings, (l, s) =>
      computeLessonCharge(s, l).effectivePriceMinor,
    )
    expect(csvLes).toContain('Nadia Al-Mansoor')
  })
})
