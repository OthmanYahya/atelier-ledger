import { describe, expect, it } from 'vitest'
import {
  computeLessonCharge,
  computePackageLedger,
  computeRetainerLedger,
  getRetainerCycleRange,
} from './billing'
import type { Lesson, RetainerCyclePayment, Student } from './types'

function makeLesson(overrides: Partial<Lesson>): Lesson {
  return {
    id: 'l-1',
    studentId: 's-1',
    date: '2026-11-10',
    startTime: '16:00',
    plannedDurationMin: 60,
    actualDurationMin: 60,
    topic: 'Lesson',
    deliveryMode: 'Online',
    status: 'Completed',
    paymentStatus: 'Unpaid',
    homeworkAssigned: '',
    nextLessonPlan: '',
    ...overrides,
  }
}

describe('billing models', () => {
  it('computes hourly proration and optional prep time', () => {
    const student: Student = {
      id: 's-hourly',
      name: 'Nadia',
      subject: 'Physics',
      contact: '',
      notes: '',
      deliveryMode: 'Online',
      status: 'Active',
      billingModel: { type: 'hourly', ratePerHourMinor: 8000, billPrepTime: true },
      createdAt: '2026-10-01',
    }
    const completed = makeLesson({
      studentId: 's-hourly',
      actualDurationMin: 75,
      prepMinutes: 15,
    })
    const charge = computeLessonCharge(student, completed)
    expect(charge.computedPriceMinor).toBe(12000) // (75 + 15)m = 1.5h * $80 = $120.00
    expect(charge.effectivePriceMinor).toBe(12000)

    const excused = makeLesson({
      studentId: 's-hourly',
      status: 'Cancelled — Excused',
      actualDurationMin: 0,
      prepMinutes: 15,
    })
    expect(computeLessonCharge(student, excused).effectivePriceMinor).toBe(0)

    const manual = makeLesson({
      studentId: 's-hourly',
      actualDurationMin: 60,
      manualOverrideMinor: 6500,
    })
    expect(computeLessonCharge(student, manual).effectivePriceMinor).toBe(6500)

    const billableNoShow = makeLesson({
      studentId: 's-hourly',
      status: 'Cancelled — Billable/No-Show',
      plannedDurationMin: 60,
      actualDurationMin: 0,
      prepMinutes: 0,
    })
    expect(computeLessonCharge(student, billableNoShow).effectivePriceMinor).toBe(8000)
  })

  it('keeps flat per-session price constant across duration changes', () => {
    const student: Student = {
      id: 's-flat',
      name: 'Liam',
      subject: 'Calculus',
      contact: '',
      notes: '',
      deliveryMode: 'Hybrid',
      status: 'Active',
      billingModel: { type: 'flat', ratePerSessionMinor: 8500 },
      createdAt: '2026-10-01',
    }
    expect(
      computeLessonCharge(student, makeLesson({ studentId: 's-flat', actualDurationMin: 45 }))
        .effectivePriceMinor,
    ).toBe(8500)
    expect(
      computeLessonCharge(student, makeLesson({ studentId: 's-flat', actualDurationMin: 90 }))
        .effectivePriceMinor,
    ).toBe(8500)
    expect(
      computeLessonCharge(
        student,
        makeLesson({
          studentId: 's-flat',
          status: 'Cancelled — Billable/No-Show',
          actualDurationMin: 0,
        }),
      ).effectivePriceMinor,
    ).toBe(8500)
  })

  it('resolves retainer cycle boundaries cleanly around cycleStartDay', () => {
    expect(getRetainerCycleRange('2026-11-10', 15)).toEqual({
      cycleKey: '2026-10',
      startISO: '2026-10-15',
      endISO: '2026-11-14',
    })
    expect(getRetainerCycleRange('2026-11-15', 15)).toEqual({
      cycleKey: '2026-11',
      startISO: '2026-11-15',
      endISO: '2026-12-14',
    })
  })

  it('computes retainer rollover, partial overages, and effective hourly rate', () => {
    const student: Student = {
      id: 's-ret',
      name: 'Tomasz',
      subject: 'Piano',
      contact: '',
      notes: '',
      deliveryMode: 'In-Person',
      status: 'Active',
      billingModel: {
        type: 'retainer',
        monthlyFeeMinor: 40000, // $400/mo
        cycleStartDay: 1,
        includedHours: 4, // 240 min/mo
        includedSessions: null,
        rolloverUnused: true,
        overageRatePerHourMinor: 9000, // $90/hr overage
      },
      createdAt: '2026-09-01',
    }
    const lessons: Lesson[] = [
      // Oct: 180 min used -> 60 min rolls over to Nov (allowance in Nov becomes 300 min)
      makeLesson({ id: 'r1', studentId: 's-ret', date: '2026-10-05', actualDurationMin: 180 }),
      // Nov: 240 min + 120 min = 360 min -> 60 min overage on r3!
      makeLesson({ id: 'r2', studentId: 's-ret', date: '2026-11-04', actualDurationMin: 240 }),
      makeLesson({ id: 'r3', studentId: 's-ret', date: '2026-11-18', actualDurationMin: 120 }),
      // Excused cancel should not consume allowance
      makeLesson({
        id: 'r4',
        studentId: 's-ret',
        date: '2026-11-20',
        actualDurationMin: 60,
        status: 'Cancelled — Excused',
      }),
    ]
    const payments: RetainerCyclePayment[] = [
      { id: 'rp1', studentId: 's-ret', cycleKey: '2026-10', paymentStatus: 'Paid', paidDate: '2026-10-02' },
    ]
    const ledger = computeRetainerLedger(student, lessons, payments, '2026-11-24')
    const oct = ledger.cycles.find((c) => c.cycleKey === '2026-10')!
    const nov = ledger.cycles.find((c) => c.cycleKey === '2026-11')!

    expect(oct.rolloverOutMinutes).toBe(60)
    expect(oct.overageTotalMinor).toBe(0)
    expect(nov.rolloverInMinutes).toBe(60)
    expect(nov.allowanceMinutes).toBe(300)
    expect(nov.overageMinutes).toBe(60)
    expect(nov.overageTotalMinor).toBe(9000)
    expect(nov.totalRevenueMinor).toBe(49000) // $400 + $90
    // 360 min = 6h taught -> $490 / 6h = $81.67/hr (8167 cents)
    expect(nov.effectiveHourlyRateMinor).toBe(8167)
    expect(computeLessonCharge(student, lessons[2], ledger).effectivePriceMinor).toBe(9000)
    expect(computeLessonCharge(student, lessons[1], ledger).isCoveredByPlan).toBe(true)
  })

  it('deducts prepaid package credits accurately for lessons and hours', () => {
    const lessonPkgStudent: Student = {
      id: 's-pkg',
      name: 'Priya',
      subject: 'Algorithms',
      contact: '',
      notes: '',
      deliveryMode: 'Online',
      status: 'Active',
      billingModel: {
        type: 'package',
        unit: 'lessons',
        defaultBundleUnits: 10,
        defaultBundlePriceMinor: 60000,
        purchases: [
          {
            id: 'p1',
            purchasedDate: '2026-11-01',
            label: '10-Lesson Pack',
            unitsGranted: 10,
            priceMinor: 60000,
            paymentStatus: 'Paid',
            paidDate: '2026-11-01',
          },
        ],
      },
      createdAt: '2026-11-01',
    }
    const lessons: Lesson[] = [
      ...Array.from({ length: 7 }, (_, i) =>
        makeLesson({ id: `p-${i}`, studentId: 's-pkg', date: `2026-11-0${i + 2}` }),
      ),
      makeLesson({
        id: 'p-noshow',
        studentId: 's-pkg',
        date: '2026-11-12',
        actualDurationMin: 0,
        status: 'Cancelled — Billable/No-Show',
      }),
      makeLesson({
        id: 'p-excused',
        studentId: 's-pkg',
        date: '2026-11-14',
        actualDurationMin: 0,
        status: 'Cancelled — Excused',
      }),
    ]
    const ledger = computePackageLedger(lessonPkgStudent, lessons)
    expect(ledger.usedUnits).toBe(8) // 7 completed + 1 billable no-show; excused not deducted
    expect(ledger.remainingUnits).toBe(2)
    expect(ledger.isLowCredit).toBe(true)
    expect(ledger.byLessonId.get('p-0')?.amortizedEarnedMinor).toBe(6000)
    expect(ledger.byLessonId.get('p-excused')?.amortizedEarnedMinor).toBe(0)

    const hourPkgStudent: Student = {
      ...lessonPkgStudent,
      id: 's-hpkg',
      billingModel: {
        type: 'package',
        unit: 'hours',
        defaultBundleUnits: 5,
        defaultBundlePriceMinor: 30000,
        purchases: [
          {
            id: 'ph1',
            purchasedDate: '2026-11-01',
            label: '5-Hour Pack',
            unitsGranted: 300, // 5h in minutes
            priceMinor: 30000,
            paymentStatus: 'Paid',
          },
        ],
      },
    }
    const hLessons = [
      makeLesson({ id: 'h1', studentId: 's-hpkg', date: '2026-11-02', actualDurationMin: 90 }),
      makeLesson({ id: 'h2', studentId: 's-hpkg', date: '2026-11-05', actualDurationMin: 120 }),
    ]
    const hLedger = computePackageLedger(hourPkgStudent, hLessons)
    expect(hLedger.remainingUnits).toBe(90) // 1.5h left <= 2h threshold
    expect(hLedger.isLowCredit).toBe(true)
    expect(hLedger.byLessonId.get('h1')?.amortizedEarnedMinor).toBe(9000)
  })
})
