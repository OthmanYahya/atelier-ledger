import { addMonthsClamped, addDaysISO } from './dates'
import { prorateHourlyMinor } from './money'
import type {
  Lesson,
  LessonStatus,
  PaymentStatus,
  RetainerCyclePayment,
  Student,
} from './types'

export function isLessonBillable(status: LessonStatus): boolean {
  return status === 'Completed' || status === 'Cancelled — Billable/No-Show'
}

export function getBillableMinutes(lesson: Lesson): number {
  if (!isLessonBillable(lesson.status)) return 0
  if (lesson.status === 'Cancelled — Billable/No-Show' && lesson.actualDurationMin <= 0) {
    return Math.max(0, lesson.plannedDurationMin)
  }
  return Math.max(0, lesson.actualDurationMin)
}

export interface StudentBillingLedgers {
  retainerLedgers: Map<string, RetainerLedgerResult>
  packageLedgers: Map<string, PackageLedgerResult>
}

export function buildStudentBillingLedgers(
  students: Student[],
  lessons: Lesson[],
  retainerPayments: RetainerCyclePayment[],
  today: string,
): StudentBillingLedgers {
  const retainerLedgers = new Map<string, RetainerLedgerResult>()
  const packageLedgers = new Map<string, PackageLedgerResult>()
  for (const s of students) {
    if (s.billingModel.type === 'retainer') {
      retainerLedgers.set(s.id, computeRetainerLedger(s, lessons, retainerPayments, today))
    } else if (s.billingModel.type === 'package') {
      packageLedgers.set(s.id, computePackageLedger(s, lessons))
    }
  }
  return { retainerLedgers, packageLedgers }
}

export function getRetainerCycleRange(
  dateISO: string,
  cycleStartDay: number,
): { cycleKey: string; startISO: string; endISO: string } {
  // shortcut: cycleStartDay clamps to 1..28 so every calendar month has that day, add end-of-month flag if 29th-31st billing anchors are needed.
  const clampedDay = Math.max(1, Math.min(28, Math.round(cycleStartDay || 1)))
  const [yStr, mStr, dStr] = dateISO.split('-')
  const y = Number.parseInt(yStr, 10)
  const m = Number.parseInt(mStr, 10)
  const d = Number.parseInt(dStr, 10)
  const monthAnchor = `${y}-${String(m).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`
  const startISO = d >= clampedDay ? monthAnchor : addMonthsClamped(monthAnchor, -1)
  const nextCycleStart = addMonthsClamped(startISO, 1)
  const endISO = addDaysISO(nextCycleStart, -1)
  return {
    cycleKey: startISO.slice(0, 7),
    startISO,
    endISO,
  }
}

export interface RetainerLessonComputation {
  lessonId: string
  cycleKey: string
  coveredMinutes: number
  overageMinutes: number
  overageChargeMinor: number
}

export interface RetainerCycleSummary {
  cycleKey: string
  startISO: string
  endISO: string
  monthlyFeeMinor: number
  overageTotalMinor: number
  totalRevenueMinor: number
  billableMinutes: number
  completedMinutes: number
  billableSessions: number
  allowanceMinutes: number | null
  allowanceSessions: number | null
  rolloverInMinutes: number
  rolloverOutMinutes: number
  overageMinutes: number
  effectiveHourlyRateMinor: number
  paymentStatus: 'Unpaid' | 'Invoiced' | 'Paid'
  paidDate?: string
  paymentMethod?: RetainerCyclePayment['paymentMethod']
  paymentRecordId?: string
}

export interface RetainerLedgerResult {
  cycles: RetainerCycleSummary[]
  byLessonId: Map<string, RetainerLessonComputation>
}

export function computeRetainerLedger(
  student: Student,
  allLessons: Lesson[],
  retainerPayments: RetainerCyclePayment[],
  today: string,
): RetainerLedgerResult {
  const byLessonId = new Map<string, RetainerLessonComputation>()
  if (student.billingModel.type !== 'retainer') {
    return { cycles: [], byLessonId }
  }
  const model = student.billingModel
  const studentLessons = allLessons
    .filter((l) => l.studentId === student.id)
    .slice()
    .sort((a, b) =>
      a.date !== b.date
        ? a.date.localeCompare(b.date)
        : a.startTime !== b.startTime
          ? a.startTime.localeCompare(b.startTime)
          : a.id.localeCompare(b.id),
    )

  const paymentMap = new Map<string, RetainerCyclePayment>()
  for (const p of retainerPayments) {
    if (p.studentId === student.id) paymentMap.set(p.cycleKey, p)
  }

  const cycleKeys = new Set<string>()
  for (const l of studentLessons) {
    cycleKeys.add(getRetainerCycleRange(l.date, model.cycleStartDay).cycleKey)
  }
  for (const k of paymentMap.keys()) {
    cycleKeys.add(k)
  }
  if (student.status === 'Active') {
    cycleKeys.add(getRetainerCycleRange(today, model.cycleStartDay).cycleKey)
  }

  if (cycleKeys.size === 0) return { cycles: [], byLessonId }

  const sortedSeedKeys = Array.from(cycleKeys).sort()
  const orderedKeys: string[] = []
  if (model.rolloverUnused && sortedSeedKeys.length > 1) {
    // Fill contiguous months between earliest and latest so rollover carries continuously.
    let cursor = `${sortedSeedKeys[0]}-${String(Math.max(1, Math.min(28, model.cycleStartDay))).padStart(2, '0')}`
    const endKey = sortedSeedKeys[sortedSeedKeys.length - 1]
    while (cursor.slice(0, 7) <= endKey) {
      orderedKeys.push(cursor.slice(0, 7))
      cursor = addMonthsClamped(cursor, 1)
    }
  } else {
    orderedKeys.push(...sortedSeedKeys)
  }

  const lessonsByCycle = new Map<string, Lesson[]>()
  for (const l of studentLessons) {
    const k = getRetainerCycleRange(l.date, model.cycleStartDay).cycleKey
    const arr = lessonsByCycle.get(k) ?? []
    arr.push(l)
    lessonsByCycle.set(k, arr)
  }

  const baseAllowanceMin =
    model.includedHours !== null && model.includedHours >= 0
      ? Math.round(model.includedHours * 60)
      : null
  const baseAllowanceSessions =
    model.includedSessions !== null && model.includedSessions >= 0
      ? Math.round(model.includedSessions)
      : null

  let rolloverMin = 0
  let rolloverSessions = 0
  const cycles: RetainerCycleSummary[] = []

  for (const cycleKey of orderedKeys) {
    const dayStr = String(Math.max(1, Math.min(28, model.cycleStartDay))).padStart(2, '0')
    const { startISO, endISO } = getRetainerCycleRange(`${cycleKey}-${dayStr}`, model.cycleStartDay)
    const lessonsInCycle = lessonsByCycle.get(cycleKey) ?? []
    const allowanceMinutes = baseAllowanceMin !== null ? baseAllowanceMin + rolloverMin : null
    const allowanceSessions =
      baseAllowanceSessions !== null ? baseAllowanceSessions + rolloverSessions : null

    const rolloverInMinutes = rolloverMin
    let usedMinutes = 0
    let completedMinutes = 0
    let usedSessions = 0
    let cycleOverageMin = 0
    let cycleOverageMinor = 0

    for (const lesson of lessonsInCycle) {
      if (!isLessonBillable(lesson.status)) {
        byLessonId.set(lesson.id, {
          lessonId: lesson.id,
          cycleKey,
          coveredMinutes: 0,
          overageMinutes: 0,
          overageChargeMinor: 0,
        })
        continue
      }

      const dur = getBillableMinutes(lesson)
      if (lesson.status === 'Completed') {
        completedMinutes += Math.max(0, lesson.actualDurationMin)
      }

      let lessonOverageMin = 0
      if (allowanceMinutes !== null) {
        const prev = usedMinutes
        const next = prev + dur
        lessonOverageMin = Math.max(0, next - Math.max(prev, allowanceMinutes))
      }
      if (allowanceSessions !== null && usedSessions + 1 > allowanceSessions) {
        lessonOverageMin = Math.max(lessonOverageMin, dur)
      }

      usedMinutes += dur
      usedSessions += 1
      const coveredMinutes = Math.max(0, dur - lessonOverageMin)
      const computedOverage = prorateHourlyMinor(model.overageRatePerHourMinor, lessonOverageMin)
      const overageChargeMinor =
        lesson.manualOverrideMinor !== undefined ? lesson.manualOverrideMinor : computedOverage

      cycleOverageMin += lessonOverageMin
      cycleOverageMinor += overageChargeMinor

      byLessonId.set(lesson.id, {
        lessonId: lesson.id,
        cycleKey,
        coveredMinutes,
        overageMinutes: lessonOverageMin,
        overageChargeMinor,
      })
    }

    if (model.rolloverUnused) {
      rolloverMin = allowanceMinutes !== null ? Math.max(0, allowanceMinutes - usedMinutes) : 0
      rolloverSessions =
        allowanceSessions !== null ? Math.max(0, allowanceSessions - usedSessions) : 0
    } else {
      rolloverMin = 0
      rolloverSessions = 0
    }

    const totalRevenueMinor = model.monthlyFeeMinor + cycleOverageMinor
    const effectiveHourlyRateMinor =
      completedMinutes > 0 ? Math.round((totalRevenueMinor * 60) / completedMinutes) : 0
    const payment = paymentMap.get(cycleKey)

    cycles.push({
      cycleKey,
      startISO,
      endISO,
      monthlyFeeMinor: model.monthlyFeeMinor,
      overageTotalMinor: cycleOverageMinor,
      totalRevenueMinor,
      billableMinutes: usedMinutes,
      completedMinutes,
      billableSessions: usedSessions,
      allowanceMinutes,
      allowanceSessions,
      rolloverInMinutes,
      rolloverOutMinutes: rolloverMin,
      overageMinutes: cycleOverageMin,
      effectiveHourlyRateMinor,
      paymentStatus: payment?.paymentStatus ?? 'Unpaid',
      paidDate: payment?.paidDate,
      paymentMethod: payment?.paymentMethod,
      paymentRecordId: payment?.id,
    })
  }

  return { cycles, byLessonId }
}

export interface PackageLessonComputation {
  lessonId: string
  unitsConsumed: number
  coveredUnits: number
  overflowUnits: number
  amortizedEarnedMinor: number
}

export interface PackageLedgerResult {
  unit: 'lessons' | 'hours'
  totalPurchasedUnits: number
  usedUnits: number
  remainingUnits: number
  isLowCredit: boolean
  unitValueMinor: number
  byLessonId: Map<string, PackageLessonComputation>
}

export function computePackageLedger(student: Student, allLessons: Lesson[]): PackageLedgerResult {
  const byLessonId = new Map<string, PackageLessonComputation>()
  if (student.billingModel.type !== 'package') {
    return {
      unit: 'lessons',
      totalPurchasedUnits: 0,
      usedUnits: 0,
      remainingUnits: 0,
      isLowCredit: false,
      unitValueMinor: 0,
      byLessonId,
    }
  }
  const model = student.billingModel
  const totalPurchasedUnits = model.purchases.reduce((acc, p) => acc + Math.max(0, p.unitsGranted), 0)
  const totalPriceMinor = model.purchases.reduce((acc, p) => acc + Math.max(0, p.priceMinor), 0)
  const fallbackUnits =
    model.unit === 'hours' ? model.defaultBundleUnits * 60 : model.defaultBundleUnits
  const unitValueMinor =
    totalPurchasedUnits > 0
      ? totalPriceMinor / totalPurchasedUnits
      : fallbackUnits > 0
        ? model.defaultBundlePriceMinor / fallbackUnits
        : 0

  const studentLessons = allLessons
    .filter((l) => l.studentId === student.id)
    .slice()
    .sort((a, b) =>
      a.date !== b.date
        ? a.date.localeCompare(b.date)
        : a.startTime !== b.startTime
          ? a.startTime.localeCompare(b.startTime)
          : a.id.localeCompare(b.id),
    )

  let usedUnits = 0
  for (const lesson of studentLessons) {
    if (!isLessonBillable(lesson.status)) {
      byLessonId.set(lesson.id, {
        lessonId: lesson.id,
        unitsConsumed: 0,
        coveredUnits: 0,
        overflowUnits: 0,
        amortizedEarnedMinor: 0,
      })
      continue
    }

    const unitsConsumed = model.unit === 'lessons' ? 1 : getBillableMinutes(lesson)
    const remainingBefore = Math.max(0, totalPurchasedUnits - usedUnits)
    const coveredUnits = Math.min(unitsConsumed, remainingBefore)
    const overflowUnits = Math.max(0, unitsConsumed - coveredUnits)
    usedUnits += unitsConsumed

    const amortizedEarnedMinor =
      lesson.manualOverrideMinor !== undefined
        ? lesson.manualOverrideMinor
        : Math.round(coveredUnits * unitValueMinor)

    byLessonId.set(lesson.id, {
      lessonId: lesson.id,
      unitsConsumed,
      coveredUnits,
      overflowUnits,
      amortizedEarnedMinor,
    })
  }

  const remainingUnits = totalPurchasedUnits - usedUnits
  const lowThreshold = model.unit === 'lessons' ? 2 : 120
  return {
    unit: model.unit,
    totalPurchasedUnits,
    usedUnits,
    remainingUnits,
    isLowCredit: totalPurchasedUnits > 0 && remainingUnits <= lowThreshold,
    unitValueMinor,
    byLessonId,
  }
}

export function formatPackageCredits(units: number, unit: 'lessons' | 'hours'): string {
  if (unit === 'lessons') {
    return `${units} ${Math.abs(units) === 1 ? 'lesson' : 'lessons'}`
  }
  const hours = units / 60
  const formatted = Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
  return `${formatted} hrs`
}

export interface LessonChargeResult {
  computedPriceMinor: number
  effectivePriceMinor: number
  isCoveredByPlan: boolean
  planNote?: string
}

export function computeLessonCharge(
  student: Student | undefined,
  lesson: Lesson,
  retainerLedger?: RetainerLedgerResult,
  packageLedger?: PackageLedgerResult,
): LessonChargeResult {
  if (!student) {
    const manual = lesson.manualOverrideMinor ?? 0
    return { computedPriceMinor: 0, effectivePriceMinor: manual, isCoveredByPlan: false }
  }

  if (lesson.status === 'Cancelled — Excused') {
    return {
      computedPriceMinor: 0,
      effectivePriceMinor: lesson.manualOverrideMinor ?? 0,
      isCoveredByPlan: false,
      planNote: 'Excused cancellation (no charge)',
    }
  }

  const durationForCharge =
    lesson.status === 'Scheduled'
      ? lesson.plannedDurationMin
      : isLessonBillable(lesson.status)
        ? getBillableMinutes(lesson)
        : lesson.actualDurationMin
  const model = student.billingModel

  switch (model.type) {
    case 'hourly': {
      const prep = model.billPrepTime ? Math.max(0, lesson.prepMinutes ?? 0) : 0
      const computed = prorateHourlyMinor(model.ratePerHourMinor, durationForCharge + prep)
      return {
        computedPriceMinor: computed,
        effectivePriceMinor: lesson.manualOverrideMinor ?? computed,
        isCoveredByPlan: false,
        planNote:
          prep > 0 ? `Includes ${prep}m billable prep` : undefined,
      }
    }
    case 'flat': {
      const computed = model.ratePerSessionMinor
      return {
        computedPriceMinor: computed,
        effectivePriceMinor: lesson.manualOverrideMinor ?? computed,
        isCoveredByPlan: false,
      }
    }
    case 'retainer': {
      const comp = retainerLedger?.byLessonId.get(lesson.id)
      if (lesson.status === 'Scheduled') {
        return {
          computedPriceMinor: 0,
          effectivePriceMinor: lesson.manualOverrideMinor ?? 0,
          isCoveredByPlan: true,
          planNote: 'Covered by monthly retainer',
        }
      }
      if (comp && comp.overageMinutes > 0) {
        return {
          computedPriceMinor: comp.overageChargeMinor,
          effectivePriceMinor: lesson.manualOverrideMinor ?? comp.overageChargeMinor,
          isCoveredByPlan: false,
          planNote: `Retainer overage (${comp.overageMinutes}m)`,
        }
      }
      return {
        computedPriceMinor: 0,
        effectivePriceMinor: lesson.manualOverrideMinor ?? 0,
        isCoveredByPlan: true,
        planNote: 'Covered by monthly retainer',
      }
    }
    case 'package': {
      const comp = packageLedger?.byLessonId.get(lesson.id)
      if (lesson.status === 'Scheduled') {
        return {
          computedPriceMinor: 0,
          effectivePriceMinor: lesson.manualOverrideMinor ?? 0,
          isCoveredByPlan: true,
          planNote: 'Uses prepaid package credit',
        }
      }
      if (comp && comp.overflowUnits > 0) {
        return {
          computedPriceMinor: 0,
          effectivePriceMinor: lesson.manualOverrideMinor ?? 0,
          isCoveredByPlan: false,
          planNote: 'Package credits exhausted (needs top-up or manual fee)',
        }
      }
      return {
        computedPriceMinor: 0,
        effectivePriceMinor: lesson.manualOverrideMinor ?? 0,
        isCoveredByPlan: true,
        planNote: 'Covered by prepaid package',
      }
    }
  }
}

export function defaultPaymentStatusForStudent(student: Student | undefined): PaymentStatus {
  if (!student) return 'Unpaid'
  if (student.billingModel.type === 'retainer' || student.billingModel.type === 'package') {
    return 'Covered by Retainer/Package'
  }
  return 'Unpaid'
}
