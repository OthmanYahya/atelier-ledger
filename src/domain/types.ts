export type TaskStatus = 'Inbox' | 'To Do' | 'In Progress' | 'Waiting' | 'Done'
export type TaskPriority = 'Urgent' | 'High' | 'Medium' | 'Low'
export type RecurrenceFrequency = 'None' | 'Daily' | 'Weekly' | 'Biweekly' | 'Monthly'

export interface RecurrenceRule {
  frequency: RecurrenceFrequency
  /** 0 (Sun) - 6 (Sat) for Weekly/Biweekly recurrence */
  weekDays?: number[]
}

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface Task {
  id: string
  title: string
  notes: string
  status: TaskStatus
  priority: TaskPriority
  tags: string[]
  dueDate?: string // YYYY-MM-DD
  dueTime?: string // HH:MM
  estimatedMin?: number
  actualDurationMin?: number
  subtasks: Subtask[]
  recurrence: RecurrenceRule
  studentId?: string
  lessonId?: string
  createdAt: string
  completedAt?: string
}

export type DeliveryMode = 'In-Person' | 'Online' | 'Hybrid'
export type StudentStatus = 'Active' | 'Paused' | 'Archived'
export type PaymentStatus =
  | 'Unpaid'
  | 'Invoiced'
  | 'Paid'
  | 'Covered by Retainer/Package'
export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'Card' | 'Other'

export interface PackagePurchase {
  id: string
  purchasedDate: string // YYYY-MM-DD
  label: string
  /** lessons count when unit==='lessons', or total minutes when unit==='hours' */
  unitsGranted: number
  priceMinor: number
  paymentStatus: 'Unpaid' | 'Invoiced' | 'Paid'
  paidDate?: string
  paymentMethod?: PaymentMethod
}

export type BillingModel =
  | {
      type: 'hourly'
      ratePerHourMinor: number
      billPrepTime: boolean
    }
  | {
      type: 'flat'
      ratePerSessionMinor: number
    }
  | {
      type: 'retainer'
      monthlyFeeMinor: number
      cycleStartDay: number // 1..28
      includedHours: number | null
      includedSessions: number | null
      rolloverUnused: boolean
      overageRatePerHourMinor: number
    }
  | {
      type: 'package'
      unit: 'lessons' | 'hours'
      defaultBundleUnits: number // lessons or hours
      defaultBundlePriceMinor: number
      purchases: PackagePurchase[]
    }

export interface Student {
  id: string
  name: string
  subject: string
  contact: string
  notes: string
  deliveryMode: DeliveryMode
  status: StudentStatus
  billingModel: BillingModel
  createdAt: string
}

export type LessonStatus =
  | 'Scheduled'
  | 'Completed'
  | 'Cancelled — Excused'
  | 'Cancelled — Billable/No-Show'

export interface Lesson {
  id: string
  studentId: string
  date: string // YYYY-MM-DD
  startTime: string // HH:MM
  plannedDurationMin: number
  actualDurationMin: number
  prepMinutes?: number
  topic: string
  deliveryMode: DeliveryMode
  status: LessonStatus
  manualOverrideMinor?: number
  overrideReason?: string
  paymentStatus: PaymentStatus
  paidDate?: string
  paymentMethod?: PaymentMethod
  homeworkAssigned: string
  nextLessonPlan: string
}

export interface RetainerCyclePayment {
  id: string
  studentId: string
  cycleKey: string // YYYY-MM
  paymentStatus: 'Unpaid' | 'Invoiced' | 'Paid'
  paidDate?: string
  paymentMethod?: PaymentMethod
}

export type ExpenseCategory =
  | 'Transport/Fuel'
  | 'Teaching Materials & Printing'
  | 'Software & Tools'
  | 'Equipment'
  | 'Utilities/Internet'
  | 'Other'

export interface Expense {
  id: string
  date: string // YYYY-MM-DD
  title: string
  category: ExpenseCategory
  amountMinor: number
  isRecurringMonthly: boolean
  paymentMethod: PaymentMethod
  notes: string
  studentId?: string
}

export interface WorkspaceSettings {
  currency: string
  defaultHourlyRateMinor: number
  defaultLessonDurationMin: number
  workingHoursStart: string // HH:MM
  workingHoursEnd: string // HH:MM
  theme: 'paper' | 'ink'
}

export interface ActiveTimerState {
  running: boolean
  startedAtMs: number | null
  accumulatedMs: number
  studentId?: string
  lessonId?: string
  topic?: string
}

export interface LedgerState {
  schemaVersion: 1
  demoLoaded: boolean
  updatedAt?: string // ISO-8601 UTC timestamp for cross-device sync conflict checks
  settings: WorkspaceSettings
  students: Student[]
  lessons: Lesson[]
  retainerPayments: RetainerCyclePayment[]
  expenses: Expense[]
  tasks: Task[]
  timer: ActiveTimerState
}

export type PeriodPreset =
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'last_90_days'
  | 'all_time'
  | 'custom'

export interface DateRange {
  start: string // YYYY-MM-DD
  end: string // YYYY-MM-DD
}
