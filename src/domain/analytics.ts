import {
  buildStudentBillingLedgers,
  computeLessonCharge,
  isLessonBillable,
} from './billing'
import { addMonthsClamped, diffDaysISO, isWithinRange, parseISODate } from './dates'
import type {
  BillingModel,
  DateRange,
  Expense,
  LedgerState,
  PaymentStatus,
  Student,
} from './types'

export interface ReceivableItem {
  kind: 'lesson' | 'retainer_cycle' | 'package_purchase'
  id: string
  studentId: string
  studentName: string
  title: string
  date: string
  amountMinor: number
  paymentStatus: 'Unpaid' | 'Invoiced'
  daysOverdue: number
  cycleKey?: string
  purchaseId?: string
}

export interface MonthlyComparisonPoint {
  monthKey: string
  label: string
  revenueMinor: number
  expensesMinor: number
  netProfitMinor: number
}

export interface BillingModelBreakdown {
  type: BillingModel['type']
  label: string
  revenueMinor: number
  hoursTaught: number
  effectiveHourlyRateMinor: number
  lessonCount: number
}

export interface StudentFinancialBreakdown {
  studentId: string
  name: string
  subject: string
  billingType: BillingModel['type']
  grossEarnedMinor: number
  attributedExpensesMinor: number
  netProfitMinor: number
  hoursTaught: number
  effectiveHourlyRateMinor: number
  unpaidMinor: number
}

export interface FinancialReport {
  grossEarnedMinor: number
  collectedCashMinor: number
  unpaidReceivablesMinor: number
  totalExpensesMinor: number
  netProfitMinor: number
  cashNetMinor: number
  totalMinutesTaught: number
  totalHoursTaught: number
  effectiveHourlyRateMinor: number
  receivables: ReceivableItem[]
  monthlySeries: MonthlyComparisonPoint[]
  byBillingModel: BillingModelBreakdown[]
  byStudent: StudentFinancialBreakdown[]
}

const MODEL_LABELS: Record<BillingModel['type'], string> = {
  hourly: 'Hourly',
  flat: 'Flat Per-Session',
  retainer: 'Monthly Retainer',
  package: 'Prepaid Package',
}

export function computeFinancialReport(
  state: LedgerState,
  range: DateRange,
  todayISO: string,
): FinancialReport {
  const studentMap = new Map<string, Student>(state.students.map((s) => [s.id, s]))
  const { retainerLedgers, packageLedgers } = buildStudentBillingLedgers(
    state.students,
    state.lessons,
    state.retainerPayments,
    todayISO,
  )

  let grossEarnedMinor = 0
  let collectedCashMinor = 0
  let totalMinutesTaught = 0
  let totalExpensesMinor = 0

  const modelStats: Record<
    BillingModel['type'],
    { revenueMinor: number; completedMinutes: number; lessonCount: number }
  > = {
    hourly: { revenueMinor: 0, completedMinutes: 0, lessonCount: 0 },
    flat: { revenueMinor: 0, completedMinutes: 0, lessonCount: 0 },
    retainer: { revenueMinor: 0, completedMinutes: 0, lessonCount: 0 },
    package: { revenueMinor: 0, completedMinutes: 0, lessonCount: 0 },
  }

  const studentStats = new Map<
    string,
    { gross: number; expenses: number; completedMinutes: number; unpaid: number }
  >()
  const ensureStudentStat = (studentId: string) => {
    let entry = studentStats.get(studentId)
    if (!entry) {
      entry = { gross: 0, expenses: 0, completedMinutes: 0, unpaid: 0 }
      studentStats.set(studentId, entry)
    }
    return entry
  }

  const receivables: ReceivableItem[] = []
  const monthlyRevenue = new Map<string, number>()
  const monthlyExpenses = new Map<string, number>()
  const addMonthlyRev = (dateISO: string, amount: number) => {
    const k = dateISO.slice(0, 7)
    monthlyRevenue.set(k, (monthlyRevenue.get(k) ?? 0) + amount)
  }
  const addMonthlyExp = (dateISO: string, amount: number) => {
    const k = dateISO.slice(0, 7)
    monthlyExpenses.set(k, (monthlyExpenses.get(k) ?? 0) + amount)
  }

  // 1. Lessons (earned + cash + overages + package amortization + lesson receivables)
  for (const lesson of state.lessons) {
    const student = studentMap.get(lesson.studentId)
    if (!student) continue
    const retLedger = retainerLedgers.get(student.id)
    const pkgLedger = packageLedgers.get(student.id)
    const charge = computeLessonCharge(student, lesson, retLedger, pkgLedger)
    const billable = isLessonBillable(lesson.status)

    let earnedForLesson = 0
    if (billable) {
      if (student.billingModel.type === 'package') {
        const comp = pkgLedger?.byLessonId.get(lesson.id)
        earnedForLesson = comp ? comp.amortizedEarnedMinor : charge.effectivePriceMinor
      } else {
        earnedForLesson = charge.effectivePriceMinor
      }
    }

    if (earnedForLesson > 0) {
      addMonthlyRev(lesson.date, earnedForLesson)
    }

    if (billable && isWithinRange(lesson.date, range)) {
      grossEarnedMinor += earnedForLesson
      modelStats[student.billingModel.type].revenueMinor += earnedForLesson
      modelStats[student.billingModel.type].lessonCount += 1
      const st = ensureStudentStat(student.id)
      st.gross += earnedForLesson

      if (lesson.status === 'Completed') {
        const mins = Math.max(0, lesson.actualDurationMin)
        totalMinutesTaught += mins
        modelStats[student.billingModel.type].completedMinutes += mins
        st.completedMinutes += mins
      }
    }

    // Cash collected on lesson payment (hourly, flat, or retainer overage / manual fee)
    if (
      billable &&
      lesson.paymentStatus === 'Paid' &&
      charge.effectivePriceMinor > 0 &&
      isWithinRange(lesson.paidDate ?? lesson.date, range)
    ) {
      collectedCashMinor += charge.effectivePriceMinor
    }

    // Lesson receivables (all open unpaid/invoiced billable lessons with positive fee)
    if (
      billable &&
      (lesson.paymentStatus === 'Unpaid' || lesson.paymentStatus === 'Invoiced') &&
      charge.effectivePriceMinor > 0
    ) {
      const st = ensureStudentStat(student.id)
      st.unpaid += charge.effectivePriceMinor
      receivables.push({
        kind: 'lesson',
        id: lesson.id,
        studentId: student.id,
        studentName: student.name,
        title: `${lesson.topic || 'Lesson'} (${lesson.date})`,
        date: lesson.date,
        amountMinor: charge.effectivePriceMinor,
        paymentStatus: lesson.paymentStatus,
        daysOverdue: Math.max(0, diffDaysISO(lesson.date, todayISO)),
      })
    }
  }

  // 2. Retainer monthly fees
  for (const [studentId, retLedger] of retainerLedgers.entries()) {
    const student = studentMap.get(studentId)!
    for (const cycle of retLedger.cycles) {
      if (cycle.monthlyFeeMinor <= 0) continue
      addMonthlyRev(cycle.startISO, cycle.monthlyFeeMinor)
      if (isWithinRange(cycle.startISO, range)) {
        grossEarnedMinor += cycle.monthlyFeeMinor
        modelStats.retainer.revenueMinor += cycle.monthlyFeeMinor
        ensureStudentStat(studentId).gross += cycle.monthlyFeeMinor
      }
      if (cycle.paymentStatus === 'Paid' && isWithinRange(cycle.paidDate ?? cycle.startISO, range)) {
        collectedCashMinor += cycle.monthlyFeeMinor
      }
      if (cycle.paymentStatus === 'Unpaid' || cycle.paymentStatus === 'Invoiced') {
        ensureStudentStat(studentId).unpaid += cycle.monthlyFeeMinor
        receivables.push({
          kind: 'retainer_cycle',
          id: `${studentId}:${cycle.cycleKey}`,
          studentId,
          studentName: student.name,
          title: `Monthly Retainer (${cycle.cycleKey})`,
          date: cycle.startISO,
          amountMinor: cycle.monthlyFeeMinor,
          paymentStatus: cycle.paymentStatus,
          daysOverdue: Math.max(0, diffDaysISO(cycle.startISO, todayISO)),
          cycleKey: cycle.cycleKey,
        })
      }
    }
  }

  // 3. Package upfront purchases (cash collected & receivables)
  for (const student of state.students) {
    if (student.billingModel.type !== 'package') continue
    for (const purchase of student.billingModel.purchases) {
      if (
        purchase.paymentStatus === 'Paid' &&
        isWithinRange(purchase.paidDate ?? purchase.purchasedDate, range)
      ) {
        collectedCashMinor += purchase.priceMinor
      }
      if (
        (purchase.paymentStatus === 'Unpaid' || purchase.paymentStatus === 'Invoiced') &&
        purchase.priceMinor > 0
      ) {
        ensureStudentStat(student.id).unpaid += purchase.priceMinor
        receivables.push({
          kind: 'package_purchase',
          id: purchase.id,
          studentId: student.id,
          studentName: student.name,
          title: purchase.label || 'Prepaid Package',
          date: purchase.purchasedDate,
          amountMinor: purchase.priceMinor,
          paymentStatus: purchase.paymentStatus,
          daysOverdue: Math.max(0, diffDaysISO(purchase.purchasedDate, todayISO)),
          purchaseId: purchase.id,
        })
      }
    }
  }

  // 4. Expenses
  for (const expense of state.expenses) {
    addMonthlyExp(expense.date, expense.amountMinor)
    if (isWithinRange(expense.date, range)) {
      totalExpensesMinor += expense.amountMinor
      if (expense.studentId && studentMap.has(expense.studentId)) {
        ensureStudentStat(expense.studentId).expenses += expense.amountMinor
      }
    }
  }

  receivables.sort((a, b) => b.daysOverdue - a.daysOverdue || a.date.localeCompare(b.date))
  const unpaidReceivablesMinor = receivables.reduce((acc, r) => acc + r.amountMinor, 0)
  const netProfitMinor = grossEarnedMinor - totalExpensesMinor
  const cashNetMinor = collectedCashMinor - totalExpensesMinor
  const totalHoursTaught = totalMinutesTaught / 60
  const effectiveHourlyRateMinor =
    totalMinutesTaught > 0 ? Math.round((netProfitMinor * 60) / totalMinutesTaught) : 0

  // 5. 6-month trend ending at todayISO's month (or range end if custom/last_month)
  const endMonthAnchor =
    range.end !== '2999-12-31' ? `${range.end.slice(0, 7)}-01` : `${todayISO.slice(0, 7)}-01`
  const monthlySeries: MonthlyComparisonPoint[] = []
  for (let i = -5; i <= 0; i++) {
    const mISO = addMonthsClamped(endMonthAnchor, i)
    const monthKey = mISO.slice(0, 7)
    const rev = monthlyRevenue.get(monthKey) ?? 0
    const exp = monthlyExpenses.get(monthKey) ?? 0
    const label = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(parseISODate(mISO))
    monthlySeries.push({
      monthKey,
      label,
      revenueMinor: rev,
      expensesMinor: exp,
      netProfitMinor: rev - exp,
    })
  }

  // 6. Billing model breakdown
  const byBillingModel: BillingModelBreakdown[] = (
    ['hourly', 'flat', 'retainer', 'package'] as const
  ).map((type) => {
    const stat = modelStats[type]
    return {
      type,
      label: MODEL_LABELS[type],
      revenueMinor: stat.revenueMinor,
      hoursTaught: stat.completedMinutes / 60,
      effectiveHourlyRateMinor:
        stat.completedMinutes > 0
          ? Math.round((stat.revenueMinor * 60) / stat.completedMinutes)
          : 0,
      lessonCount: stat.lessonCount,
    }
  })

  // 7. Student ranking by effective hourly rate after attributed expenses
  const byStudent: StudentFinancialBreakdown[] = state.students
    .map((s) => {
      const stat = studentStats.get(s.id) ?? {
        gross: 0,
        expenses: 0,
        completedMinutes: 0,
        unpaid: 0,
      }
      const net = stat.gross - stat.expenses
      const rate =
        stat.completedMinutes > 0 ? Math.round((net * 60) / stat.completedMinutes) : 0
      return {
        studentId: s.id,
        name: s.name,
        subject: s.subject,
        billingType: s.billingModel.type,
        grossEarnedMinor: stat.gross,
        attributedExpensesMinor: stat.expenses,
        netProfitMinor: net,
        hoursTaught: stat.completedMinutes / 60,
        effectiveHourlyRateMinor: rate,
        unpaidMinor: stat.unpaid,
      }
    })
    .filter((row) => row.grossEarnedMinor > 0 || row.attributedExpensesMinor > 0 || row.unpaidMinor > 0)
    .sort((a, b) => b.effectiveHourlyRateMinor - a.effectiveHourlyRateMinor || b.netProfitMinor - a.netProfitMinor)

  return {
    grossEarnedMinor,
    collectedCashMinor,
    unpaidReceivablesMinor,
    totalExpensesMinor,
    netProfitMinor,
    cashNetMinor,
    totalMinutesTaught,
    totalHoursTaught,
    effectiveHourlyRateMinor,
    receivables,
    monthlySeries,
    byBillingModel,
    byStudent,
  }
}

export function getPendingRecurringExpenses(expenses: Expense[], monthKey: string): Expense[] {
  const recurring = expenses.filter((e) => e.isRecurringMonthly)
  const seenInMonth = new Set(
    expenses
      .filter((e) => e.date.slice(0, 7) === monthKey)
      .map((e) => `${e.title.toLowerCase()}::${e.category}`),
  )
  const uniqueLatest = new Map<string, Expense>()
  for (const e of recurring) {
    const key = `${e.title.toLowerCase()}::${e.category}`
    if (!seenInMonth.has(key)) {
      const prev = uniqueLatest.get(key)
      if (!prev || e.date > prev.date) uniqueLatest.set(key, e)
    }
  }
  return Array.from(uniqueLatest.values())
}

export function isPaymentSettled(status: PaymentStatus): boolean {
  return status === 'Paid' || status === 'Covered by Retainer/Package'
}
